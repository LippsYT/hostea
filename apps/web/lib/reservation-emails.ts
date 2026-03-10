import { addHours, differenceInCalendarDays, endOfDay, format, startOfDay, subHours } from 'date-fns';
import { PaymentStatus, ReservationStatus } from '@prisma/client';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { prisma } from '@/lib/db';
import { calcBreakdown } from '@/lib/intelligent-pricing';
import { sendEmail } from '@/lib/email';
import { buildHosteaInvoicePdf } from '@/lib/simple-pdf';
import { ensureReservationNumber } from '@/lib/reservation-number';
import { resolveAppOrigin } from '@/lib/app-url';

const formatDateForEmail = (value: Date) => format(value, 'dd/MM/yyyy');
const formatMoneyForEmail = (value: number) => `USD ${value.toFixed(2)}`;
const contactEmail = process.env.EMAIL_FROM_CONTACT || 'contacto@gohostea.com';
const appBaseUrl = resolveAppOrigin();
const CONFIRMABLE_RESERVATION_STATUSES: ReservationStatus[] = [
  ReservationStatus.CONFIRMED,
  ReservationStatus.CHECKED_IN,
  ReservationStatus.COMPLETED
];

const safeText = (value: string | null | undefined, fallback = '-') =>
  (value || '').trim() || fallback;
const escapeHtml = (value: string | null | undefined) =>
  (value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const emailKey = (reservationId: string, type: string) => `reservationEmail:${type}:${reservationId}`;

const hasEmailBeenSentFallback = async (key: string, db = prisma) => {
  const row = await db.settings.findUnique({ where: { key } });
  return Boolean(row);
};

const markEmailSentFallback = async (key: string, db = prisma) => {
  await db.settings.upsert({
    where: { key },
    update: { value: { sentAt: new Date().toISOString() } },
    create: { key, value: { sentAt: new Date().toISOString() } }
  });
};

const markEmailErrorFallback = async (key: string, error: string, db = prisma) => {
  await db.settings.upsert({
    where: { key: `${key}:error` },
    update: { value: { error, at: new Date().toISOString() } },
    create: { key: `${key}:error`, value: { error, at: new Date().toISOString() } }
  });
};

let reservationEmailColumnsCache: boolean | null = null;

const hasReservationEmailColumns = async (db = prisma) => {
  if (reservationEmailColumnsCache !== null) return reservationEmailColumnsCache;
  try {
    const rows = (await db.$queryRawUnsafe(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'Reservation'
        AND column_name IN ('confirmation_email_sent','confirmation_email_sent_at')
    `)) as Array<{ column_name: string }>;

    const names = new Set(rows.map((row) => row.column_name));
    reservationEmailColumnsCache =
      names.has('confirmation_email_sent') && names.has('confirmation_email_sent_at');
    return reservationEmailColumnsCache;
  } catch {
    reservationEmailColumnsCache = false;
    return false;
  }
};

const hasEmailBeenSent = async (reservationId: string, key: string, db = prisma) => {
  if (await hasReservationEmailColumns(db)) {
    try {
      const rows = (await db.$queryRawUnsafe(
        `SELECT "confirmation_email_sent" FROM public."Reservation" WHERE id = $1 LIMIT 1`,
        reservationId
      )) as Array<{ confirmation_email_sent: boolean }>;
      return Boolean(rows[0]?.confirmation_email_sent);
    } catch {
      return hasEmailBeenSentFallback(key, db);
    }
  }
  return hasEmailBeenSentFallback(key, db);
};

const markEmailSent = async (reservationId: string, key: string, db = prisma) => {
  if (await hasReservationEmailColumns(db)) {
    try {
      await db.$executeRawUnsafe(
        `
        UPDATE public."Reservation"
        SET "confirmation_email_sent" = true,
            "confirmation_email_sent_at" = NOW(),
            "confirmation_email_error" = NULL,
            "updatedAt" = NOW()
        WHERE id = $1
        `,
        reservationId
      );
      return;
    } catch {
      await markEmailSentFallback(key, db);
      return;
    }
  }
  await markEmailSentFallback(key, db);
};

const markEmailError = async (reservationId: string, key: string, error: string, db = prisma) => {
  if (await hasReservationEmailColumns(db)) {
    try {
      await db.$executeRawUnsafe(
        `
        UPDATE public."Reservation"
        SET "confirmation_email_sent" = false,
            "confirmation_email_error" = $2,
            "updatedAt" = NOW()
        WHERE id = $1
        `,
        reservationId,
        error.slice(0, 500)
      );
    } catch {}
  }
  await markEmailErrorFallback(key, error, db);
};

let confirmationTemplateCache: string | null = null;

const getReservationConfirmationTemplate = () => {
  if (confirmationTemplateCache) return confirmationTemplateCache;

  const configuredPath = process.env.RESERVATION_CONFIRMATION_TEMPLATE_PATH?.trim();
  const candidates = [
    configuredPath || '',
    path.join(process.cwd(), 'templates', 'reservation-confirmed.html'),
    path.join(process.cwd(), 'apps', 'web', 'templates', 'reservation-confirmed.html')
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      confirmationTemplateCache = readFileSync(candidate, 'utf-8');
      return confirmationTemplateCache;
    }
  }

  confirmationTemplateCache = `
  <div style="margin:0;padding:0;background:#f4f6fb;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f4f6fb;padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="640" cellspacing="0" cellpadding="0" border="0" style="width:640px;max-width:92%;border-collapse:separate;border-spacing:0;background:#ffffff;border-radius:20px;overflow:hidden;border:1px solid #e5eaf3;">
            <tr>
              <td style="padding:24px 28px;background:linear-gradient(90deg,#ff8a4c 0%,#ff5a8e 48%,#6b3ef2 100%);">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td valign="middle">
                      <img src="{{logo_url}}" width="112" alt="Hostea" style="display:block;max-width:112px;height:auto;border:0;" />
                    </td>
                    <td align="right" valign="middle" style="color:#ffffff;font-family:Arial,sans-serif;">
                      <p style="margin:0;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;opacity:0.9;">{{booking_type_label}}</p>
                      <p style="margin:6px 0 0 0;font-size:13px;font-weight:700;">Reserva {{reservation_number}}</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:28px 28px 8px 28px;font-family:Arial,sans-serif;color:#0f172a;">
                <p style="margin:0;font-size:14px;color:#475569;">Hola {{guest_name}},</p>
                <h1 style="margin:10px 0 8px 0;font-size:28px;line-height:1.2;color:#0f172a;">Tu reserva esta confirmada</h1>
                <p style="margin:0 0 20px 0;font-size:14px;line-height:1.6;color:#475569;">Tu pago fue acreditado correctamente. Te compartimos todos los detalles para tu viaje.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:0 28px 0 28px;">
                <img src="{{property_image_url}}" alt="{{property_name}}" style="display:block;width:100%;height:auto;border:0;border-radius:16px;max-height:280px;object-fit:cover;" />
              </td>
            </tr>
            <tr>
              <td style="padding:20px 28px 0 28px;font-family:Arial,sans-serif;color:#0f172a;">
                <h2 style="margin:0;font-size:22px;line-height:1.3;">{{property_name}}</h2>
                <p style="margin:8px 0 0 0;font-size:14px;color:#64748b;line-height:1.5;">{{property_address}}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 28px 0 28px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;padding:14px 16px;font-family:Arial,sans-serif;">
                  <tr>
                    <td style="padding:8px 0;color:#64748b;font-size:13px;">Estado del pago</td>
                    <td style="padding:8px 0;text-align:right;color:#0f766e;font-size:13px;font-weight:700;">{{reservation_status}}</td>
                  </tr>
                  <tr>
                    <td style="padding:8px 0;color:#64748b;font-size:13px;">{{stay_primary_label}}</td>
                    <td style="padding:8px 0;text-align:right;color:#0f172a;font-size:13px;font-weight:600;">{{stay_primary_value}}</td>
                  </tr>
                  {{stay_secondary_html}}
                  <tr>
                    <td style="padding:8px 0;color:#64748b;font-size:13px;">{{guests_label}}</td>
                    <td style="padding:8px 0;text-align:right;color:#0f172a;font-size:13px;font-weight:600;">{{guests_value}}</td>
                  </tr>
                  <tr>
                    <td style="padding:10px 0 0 0;color:#334155;font-size:14px;font-weight:700;">Total pagado</td>
                    <td style="padding:10px 0 0 0;text-align:right;color:#0f172a;font-size:22px;font-weight:700;">{{total_amount}}</td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 28px 0 28px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td style="vertical-align:top;padding-right:8px;">
                      <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:14px;padding:14px 14px;font-family:Arial,sans-serif;">
                        <p style="margin:0 0 8px 0;font-size:12px;font-weight:700;letter-spacing:0.06em;color:#64748b;text-transform:uppercase;">Check-in</p>
                        <p style="margin:0;font-size:13px;line-height:1.6;color:#0f172a;">{{checkin_instructions}}</p>
                      </div>
                    </td>
                    <td style="vertical-align:top;padding-left:8px;">
                      <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:14px;padding:14px 14px;font-family:Arial,sans-serif;">
                        <p style="margin:0 0 8px 0;font-size:12px;font-weight:700;letter-spacing:0.06em;color:#64748b;text-transform:uppercase;">Check-out y soporte</p>
                        <p style="margin:0 0 8px 0;font-size:13px;line-height:1.6;color:#0f172a;">{{checkout_instructions}}</p>
                        <p style="margin:0;font-size:13px;line-height:1.6;color:#0f172a;">{{support_phone}}</p>
                      </div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 28px 26px 28px;">
                <a href="{{reservation_url}}" style="display:inline-block;padding:12px 22px;border-radius:999px;background:linear-gradient(90deg,#ff8a4c 0%,#ff5a8e 48%,#6b3ef2 100%);color:#ffffff;font-family:Arial,sans-serif;font-size:14px;font-weight:700;text-decoration:none;">Ver mi reserva</a>
                <p style="margin:16px 0 0 0;font-family:Arial,sans-serif;font-size:12px;line-height:1.5;color:#64748b;">Te adjuntamos la factura PDF de esta reserva. Si necesitas ayuda, escribinos a {{contact_email}}.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </div>
  `.trim();

  return confirmationTemplateCache;
};

const renderTemplate = (template: string, variables: Record<string, string>) =>
  template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) => variables[key] ?? '');

const ensureSystemMessage = async (reservationId: string, body: string, db = prisma) => {
  const reservation = await db.reservation.findUnique({
    where: { id: reservationId },
    select: {
      thread: { select: { id: true } },
      listing: { select: { hostId: true } }
    }
  });
  if (!reservation?.thread?.id) return;
  const exists = await db.message.findFirst({
    where: {
      threadId: reservation.thread.id,
      senderId: reservation.listing.hostId,
      body
    }
  });
  if (exists) return;
  await db.message.create({
    data: {
      threadId: reservation.thread.id,
      senderId: reservation.listing.hostId,
      body
    }
  });
};

const buildInvoiceBreakdown = (reservation: {
  checkIn: Date;
  checkOut: Date;
  total: any;
  listing: { cleaningFee: any; taxRate: any };
}) => {
  const total = Number(reservation.total || 0);
  const cleaning = Number(reservation.listing.cleaningFee || 0);
  const normalizedTaxRate =
    Number(reservation.listing.taxRate) > 1
      ? Number(reservation.listing.taxRate) / 100
      : Number(reservation.listing.taxRate || 0);
  const subtotalBeforeTax = normalizedTaxRate > 0 ? total / (1 + normalizedTaxRate) : total;
  const taxes = Math.max(total - subtotalBeforeTax, 0);
  const reservationCore = Math.max(subtotalBeforeTax - cleaning, 0);
  const split = calcBreakdown(reservationCore);
  const nights = Math.max(differenceInCalendarDays(reservation.checkOut, reservation.checkIn), 1);
  return {
    nights,
    total,
    cleaning,
    taxes,
    serviceFee: split.guestFee,
    hostCommission: split.platformFee,
    adminCharges: split.stripeFee,
    hostBase: split.hostBase,
    hostNet: split.hostNet
  };
};

const buildInvoicePdf = (data: {
  reservationNumber: string;
  issuedAt: Date;
  bookingTypeLabel: string;
  guestName: string;
  guestEmail: string;
  listingTitle: string;
  address: string;
  primaryDateLabel: string;
  primaryDateValue: string;
  secondaryDateLabel?: string;
  secondaryDateValue?: string;
  guestsLabel: string;
  guestsValue: string;
  paymentStatus: string;
  currency: string;
  total: number;
  baseAmount: number;
  cleaning: number;
  taxes: number;
  serviceFee: number;
  supportPhone?: string;
  propertyImageUrl?: string;
}) => {
  return buildHosteaInvoicePdf({
    reservationNumber: data.reservationNumber,
    issuedAt: format(data.issuedAt, 'dd/MM/yyyy HH:mm'),
    paymentStatus: data.paymentStatus,
    bookingTypeLabel: data.bookingTypeLabel,
    guestName: data.guestName,
    guestEmail: data.guestEmail,
    listingTitle: data.listingTitle,
    address: data.address,
    primaryDateLabel: data.primaryDateLabel,
    primaryDateValue: data.primaryDateValue,
    secondaryDateLabel: data.secondaryDateLabel,
    secondaryDateValue: data.secondaryDateValue,
    guestsLabel: data.guestsLabel,
    guestsValue: data.guestsValue,
    currency: data.currency,
    baseAmount: data.baseAmount,
    cleaningAmount: data.cleaning,
    taxAmount: data.taxes,
    serviceFeeAmount: data.serviceFee,
    totalAmount: data.total,
    supportEmail: contactEmail,
    supportPhone: data.supportPhone,
    propertyImageUrl: data.propertyImageUrl
  });
};

const buildGuestConfirmationHtml = (input: {
  reservationNumber: string;
  bookingTypeLabel: string;
  guestName: string;
  listingTitle: string;
  listingPhoto: string | null;
  address: string;
  primaryDateLabel: string;
  primaryDateValue: string;
  secondaryDateLabel?: string;
  secondaryDateValue?: string;
  guestsLabel: string;
  guestsValue: string;
  total: number;
  paymentStatus: string;
  checkInInstructions: string | null;
  checkOutInstructions: string | null;
  assistancePhone: string | null;
  assistancePhoneSecondary: string | null;
  reservationUrl: string;
}) => {
  const secondaryDateHtml =
    input.secondaryDateLabel && input.secondaryDateValue
      ? `
        <tr>
          <td style="padding:8px 0;color:#64748b;font-size:13px;">${escapeHtml(input.secondaryDateLabel)}</td>
          <td style="padding:8px 0;text-align:right;color:#0f172a;font-size:13px;font-weight:600;">${escapeHtml(input.secondaryDateValue)}</td>
        </tr>
      `
      : '';
  const logoUrl = process.env.EMAIL_LOGO_URL || `${appBaseUrl}/brand/hostea-logo.jpeg`;
  const instructionsCheckIn = safeText(input.checkInInstructions, 'Se enviaran por mensaje antes de tu llegada.');
  const instructionsCheckOut = safeText(input.checkOutInstructions, 'El anfitrion confirmara este dato en el chat.');
  const supportLines = [safeText(input.assistancePhone), safeText(input.assistancePhoneSecondary)]
    .filter((value, index, arr) => value !== '-' && arr.indexOf(value) === index)
    .join(' | ');
  const supportText = supportLines || contactEmail;

  const template = getReservationConfirmationTemplate();
  return renderTemplate(template, {
    logo_url: logoUrl,
    guest_name: escapeHtml(input.guestName),
    booking_type_label: escapeHtml(input.bookingTypeLabel),
    reservation_number: escapeHtml(input.reservationNumber),
    reservation_status: escapeHtml(input.paymentStatus),
    property_name: escapeHtml(input.listingTitle),
    property_address: escapeHtml(input.address),
    property_image_url: input.listingPhoto || logoUrl,
    stay_primary_label: escapeHtml(input.primaryDateLabel),
    stay_primary_value: escapeHtml(input.primaryDateValue),
    stay_secondary_html: secondaryDateHtml,
    guests_label: escapeHtml(input.guestsLabel),
    guests_value: escapeHtml(input.guestsValue),
    total_amount: formatMoneyForEmail(input.total),
    checkin_instructions: escapeHtml(instructionsCheckIn),
    checkout_instructions: escapeHtml(instructionsCheckOut),
    support_phone: escapeHtml(supportText),
    contact_email: escapeHtml(contactEmail),
    reservation_url: input.reservationUrl
  });
};

const buildHostReservationHtml = (input: {
  reservationNumber: string;
  guestName: string;
  checkIn: Date;
  checkOut: Date;
  total: number;
  hostNet: number;
  panelUrl: string;
}) => `
  <div style="font-family:Arial,sans-serif;color:#0f172a;line-height:1.5">
    <h2 style="margin-bottom:8px;">Nueva reserva recibida</h2>
    <p>Numero de reserva: <strong>${input.reservationNumber}</strong></p>
    <ul>
      <li>Huesped: ${input.guestName}</li>
      <li>Check-in: ${formatDateForEmail(input.checkIn)}</li>
      <li>Check-out: ${formatDateForEmail(input.checkOut)}</li>
      <li>Total pagado: ${formatMoneyForEmail(input.total)}</li>
      <li>Neto estimado anfitrion: ${formatMoneyForEmail(input.hostNet)}</li>
    </ul>
    <p>
      <a href="${input.panelUrl}" style="display:inline-block;padding:10px 14px;background:#0f172a;color:#fff;text-decoration:none;border-radius:999px;">
        Abrir panel
      </a>
    </p>
    <p style="font-size:12px;color:#64748b;">Liquidacion al anfitrion una vez acreditado el pago por el procesador.</p>
  </div>
`;

const getReservationPayload = async (reservationId: string, db = prisma) => {
  return db.reservation.findUnique({
    where: { id: reservationId },
    include: {
      payment: true,
      user: { include: { profile: true } },
      listing: {
        include: {
          photos: { orderBy: { sortOrder: 'asc' } },
          host: { include: { profile: true } }
        }
      },
      upsellExperience: true
    }
  });
};

export const sendReservationConfirmedEmails = async (
  reservationId: string,
  db = prisma,
  options?: { force?: boolean }
) => {
  const confirmationKey = emailKey(reservationId, 'confirmed');
  if (!options?.force && (await hasEmailBeenSent(reservationId, confirmationKey, db))) {
    return { sent: false, reason: 'already-sent' as const };
  }

  const payload = await getReservationPayload(reservationId, db);
  if (!payload) return { sent: false, reason: 'not-found' as const };
  if (!CONFIRMABLE_RESERVATION_STATUSES.includes(payload.status)) {
    return { sent: false, reason: 'not-confirmed' as const };
  }
  if (payload.payment?.status !== PaymentStatus.SUCCEEDED) {
    return { sent: false, reason: 'payment-not-succeeded' as const };
  }

  const reservationNumber =
    payload.reservationNumber ||
    (await ensureReservationNumber(db, payload.id, payload.createdAt)) ||
    payload.id;
  const hasUpsellExperience = Boolean(payload.upsellExperienceId);
  const bookingTypeLabel = hasUpsellExperience ? 'Alojamiento + experiencia' : 'Alojamiento';
  const hostName = payload.listing.host.profile?.name || payload.listing.host.email;
  const guestName = payload.user.profile?.name || payload.user.email;
  const breakdown = buildInvoiceBreakdown(payload);
  const reservationUrl = `${appBaseUrl}/dashboard/client?reservationId=${payload.id}`;
  const panelUrl = `${appBaseUrl}/dashboard/host/reservations?reservationId=${payload.id}`;

  const pdfBuffer = buildInvoicePdf({
    reservationNumber,
    issuedAt: new Date(),
    bookingTypeLabel,
    guestName,
    guestEmail: payload.user.email,
    listingTitle: payload.listing.title,
    address: `${payload.listing.address}, ${payload.listing.neighborhood}, ${payload.listing.city}`,
    primaryDateLabel: 'Check-in',
    primaryDateValue: formatDateForEmail(payload.checkIn),
    secondaryDateLabel: 'Check-out',
    secondaryDateValue: formatDateForEmail(payload.checkOut),
    guestsLabel: 'Huespedes',
    guestsValue: String(payload.guestsCount),
    paymentStatus: payload.payment.status,
    currency: payload.currency || 'USD',
    total: Number(payload.total),
    baseAmount: Math.max(Number(payload.total) - breakdown.cleaning - breakdown.taxes - breakdown.serviceFee, 0),
    cleaning: breakdown.cleaning,
    taxes: breakdown.taxes,
    serviceFee: breakdown.serviceFee,
    supportPhone: payload.listing.assistancePhone || undefined,
    propertyImageUrl: payload.listing.photos[0]?.url || undefined
  });

  const guestHtml = buildGuestConfirmationHtml({
    reservationNumber,
    bookingTypeLabel,
    guestName,
    listingTitle: payload.listing.title,
    listingPhoto: payload.listing.photos[0]?.url || null,
    address: `${payload.listing.address}, ${payload.listing.neighborhood}, ${payload.listing.city}`,
    primaryDateLabel: 'Check-in',
    primaryDateValue: formatDateForEmail(payload.checkIn),
    secondaryDateLabel: 'Check-out',
    secondaryDateValue: formatDateForEmail(payload.checkOut),
    guestsLabel: 'Huespedes',
    guestsValue: String(payload.guestsCount),
    total: Number(payload.total),
    paymentStatus: payload.payment.status,
    checkInInstructions: payload.listing.checkInInstructions,
    checkOutInstructions: payload.listing.checkOutInstructions,
    assistancePhone: payload.listing.assistancePhone,
    assistancePhoneSecondary: payload.listing.assistancePhoneSecondary,
    reservationUrl
  });

  const hostHtml = buildHostReservationHtml({
    reservationNumber,
    guestName,
    checkIn: payload.checkIn,
    checkOut: payload.checkOut,
    total: Number(payload.total),
    hostNet: breakdown.hostNet,
    panelUrl
  });

  try {
    await sendEmail({
      to: payload.user.email,
      subject: `Reserva confirmada ${reservationNumber}`,
      html: guestHtml,
      attachments: [
        {
          filename: `factura-${reservationNumber}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf'
        }
      ]
    });

    await sendEmail({
      to: payload.listing.host.email,
      subject: `Nueva reserva ${reservationNumber}`,
      html: hostHtml
    });

    await ensureSystemMessage(
      payload.id,
      'Tu reserva fue confirmada. En este correo encontraras tu factura y las instrucciones de ingreso.',
      db
    );

    await markEmailSent(payload.id, confirmationKey, db);
    return { sent: true as const };
  } catch (error: any) {
    const reason = error?.message || 'Error enviando email de confirmacion';
    await markEmailError(payload.id, confirmationKey, reason, db);
    console.error('reservation-confirmation-email-error', {
      reservationId: payload.id,
      reason
    });
    return { sent: false as const, reason: 'email-error' as const };
  }
};

export const sendCheckInReminderEmail = async (reservationId: string, db = prisma) => {
  const payload = await getReservationPayload(reservationId, db);
  if (!payload || payload.payment?.status !== PaymentStatus.SUCCEEDED) return;
  const appUrl = appBaseUrl;
  await sendEmail({
    to: payload.user.email,
    subject: 'Recordatorio de check-in (24h)',
    html: `
      <div style="font-family:Arial,sans-serif;color:#0f172a">
        <h2>Tu check-in es manana</h2>
        <p>Reserva: ${payload.reservationNumber || payload.id}</p>
        <p>Te compartimos la informacion importante para tu llegada.</p>
        <p><strong>Check-in:</strong> ${formatDateForEmail(payload.checkIn)} (${payload.listing.checkInTime})</p>
        <p><strong>Instrucciones:</strong> ${safeText(payload.listing.checkInInstructions)}</p>
        <p><strong>Asistencia:</strong> ${safeText(payload.listing.assistancePhone)}</p>
        <p><a href="${appUrl}/dashboard/client?reservationId=${payload.id}">Ver reserva</a></p>
      </div>
    `
  });
  await ensureSystemMessage(
    payload.id,
    'Tu check-in es manana. Te compartimos la informacion importante para tu llegada.',
    db
  );
};

export const sendPostCheckoutEmail = async (reservationId: string, db = prisma) => {
  const payload = await getReservationPayload(reservationId, db);
  if (!payload) return;
  await sendEmail({
    to: payload.user.email,
    subject: 'Gracias por tu estadia en Hostea',
    html: `
      <div style="font-family:Arial,sans-serif;color:#0f172a">
        <h2>Gracias por tu estadia</h2>
        <p>Nos encantaria conocer tu experiencia en ${payload.listing.title}.</p>
        <p><a href="${appBaseUrl}/dashboard/client?reservationId=${payload.id}">Dejar una resena</a></p>
      </div>
    `
  });
  await ensureSystemMessage(
    payload.id,
    'Gracias por tu estadia. Nos encantaria conocer tu experiencia.',
    db
  );
};

export const runReservationLifecycleEmailAutomation = async (db = prisma, now = new Date()) => {
  const tomorrow = addHours(now, 24);
  const reminderRows = await db.reservation.findMany({
    where: {
      status: { in: [ReservationStatus.CONFIRMED, ReservationStatus.CHECKED_IN] },
      payment: { status: PaymentStatus.SUCCEEDED },
      checkIn: {
        gte: startOfDay(tomorrow),
        lte: endOfDay(tomorrow)
      }
    },
    select: { id: true }
  });

  for (const row of reminderRows) {
    const key = emailKey(row.id, 'checkin-24h');
    if (await hasEmailBeenSent(row.id, key, db)) continue;
    await sendCheckInReminderEmail(row.id, db);
    await markEmailSent(row.id, key, db);
  }

  const postCheckoutRows = await db.reservation.findMany({
    where: {
      status: {
        in: [
          ReservationStatus.CONFIRMED,
          ReservationStatus.CHECKED_IN,
          ReservationStatus.COMPLETED
        ]
      },
      payment: { status: PaymentStatus.SUCCEEDED },
      checkOut: {
        lte: subHours(now, 2),
        gte: subHours(now, 72)
      }
    },
    select: { id: true }
  });

  for (const row of postCheckoutRows) {
    const key = emailKey(row.id, 'post-checkout');
    if (await hasEmailBeenSent(row.id, key, db)) continue;
    await sendPostCheckoutEmail(row.id, db);
    await markEmailSent(row.id, key, db);
  }

  return {
    reminders: reminderRows.length,
    postCheckout: postCheckoutRows.length
  };
};

