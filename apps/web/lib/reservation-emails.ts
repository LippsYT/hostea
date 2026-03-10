import { addHours, differenceInCalendarDays, endOfDay, format, startOfDay, subHours } from 'date-fns';
import { PaymentStatus, ReservationStatus } from '@prisma/client';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { prisma } from '@/lib/db';
import { calcBreakdown } from '@/lib/intelligent-pricing';
import { sendEmail } from '@/lib/email';
import { buildSimplePdfBuffer } from '@/lib/simple-pdf';
import { ensureReservationNumber } from '@/lib/reservation-number';
import { resolveAppOrigin } from '@/lib/app-url';

const formatDateForEmail = (value: Date) => format(value, 'yyyy-MM-dd');
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
    <div style="font-family:Arial,sans-serif;color:#0f172a;line-height:1.5">
      <h2 style="margin-bottom:8px;">HOSTEA - Reserva confirmada</h2>
      <p>Hola <strong>{{guest_name}}</strong>, tu reserva fue confirmada.</p>
      <p><strong>{{property_name}}</strong></p>
      <p>{{property_address}}</p>
      <ul>
        <li>Check-in: {{check_in}}</li>
        <li>Check-out: {{check_out}}</li>
        <li>Huespedes: {{guests}}</li>
        <li>Total pagado: {{total_amount}}</li>
      </ul>
      <p><a href="{{reservation_url}}">Ver reserva</a></p>
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
  guestName: string;
  listingTitle: string;
  address: string;
  checkIn: Date;
  checkOut: Date;
  guestsCount: number;
  paymentStatus: string;
  total: number;
  cleaning: number;
  taxes: number;
  serviceFee: number;
}) => {
  const lines = [
    'HOSTEA - Factura de reserva',
    `Reserva: ${data.reservationNumber}`,
    `Emitida: ${format(data.issuedAt, 'yyyy-MM-dd HH:mm')}`,
    '',
    `Huesped: ${data.guestName}`,
    `Alojamiento: ${data.listingTitle}`,
    `Direccion: ${data.address}`,
    `Check-in: ${format(data.checkIn, 'yyyy-MM-dd')}`,
    `Check-out: ${format(data.checkOut, 'yyyy-MM-dd')}`,
    `Huespedes: ${data.guestsCount}`,
    '',
    `Tarifa base: ${formatMoneyForEmail(Math.max(data.total - data.cleaning - data.taxes - data.serviceFee, 0))}`,
    `Limpieza: ${formatMoneyForEmail(data.cleaning)}`,
    `Impuestos: ${formatMoneyForEmail(data.taxes)}`,
    `Tarifa servicio Hostea: ${formatMoneyForEmail(data.serviceFee)}`,
    `TOTAL PAGADO: ${formatMoneyForEmail(data.total)}`,
    `Estado del pago: ${data.paymentStatus}`,
    '',
    `Soporte Hostea: ${contactEmail}`
  ];

  return buildSimplePdfBuffer(lines);
};

const buildGuestConfirmationHtml = (input: {
  reservationNumber: string;
  guestName: string;
  listingTitle: string;
  listingPhoto: string | null;
  address: string;
  checkIn: Date;
  checkOut: Date;
  guestsCount: number;
  total: number;
  paymentStatus: string;
  checkInInstructions: string | null;
  checkOutInstructions: string | null;
  assistancePhone: string | null;
  assistancePhoneSecondary: string | null;
  reservationUrl: string;
}) => {
  const template = getReservationConfirmationTemplate();
  const content = renderTemplate(template, {
    guest_name: input.guestName,
    property_name: input.listingTitle,
    property_address: input.address,
    check_in: formatDateForEmail(input.checkIn),
    check_out: formatDateForEmail(input.checkOut),
    guests: String(input.guestsCount),
    total_amount: formatMoneyForEmail(input.total),
    reservation_url: input.reservationUrl,
    property_image_url:
      input.listingPhoto || `${appBaseUrl}/brand/hostea-logo.jpeg`
  });

  return `
    ${content}
    <div style="font-family:Arial,sans-serif;color:#0f172a;line-height:1.5;margin-top:16px;">
      <p><strong>Numero de reserva:</strong> ${input.reservationNumber}</p>
      <p><strong>Estado del pago:</strong> ${input.paymentStatus}</p>
      <p><strong>Instrucciones check-in:</strong> ${safeText(input.checkInInstructions)}</p>
      <p><strong>Instrucciones check-out:</strong> ${safeText(input.checkOutInstructions)}</p>
      <p><strong>Asistencia:</strong> ${safeText(input.assistancePhone)}</p>
      <p><strong>Asistencia secundaria:</strong> ${safeText(input.assistancePhoneSecondary)}</p>
      <p>Te adjuntamos tu factura en PDF.</p>
      <p style="font-size:12px;color:#64748b;">Contacto: ${contactEmail}</p>
    </div>
  `;
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
      }
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
  const hostName = payload.listing.host.profile?.name || payload.listing.host.email;
  const guestName = payload.user.profile?.name || payload.user.email;
  const breakdown = buildInvoiceBreakdown(payload);
  const reservationUrl = `${appBaseUrl}/dashboard/client?reservationId=${payload.id}`;
  const panelUrl = `${appBaseUrl}/dashboard/host/reservations?reservationId=${payload.id}`;

  const pdfBuffer = buildInvoicePdf({
    reservationNumber,
    issuedAt: new Date(),
    guestName,
    listingTitle: payload.listing.title,
    address: `${payload.listing.address}, ${payload.listing.neighborhood}, ${payload.listing.city}`,
    checkIn: payload.checkIn,
    checkOut: payload.checkOut,
    guestsCount: payload.guestsCount,
    paymentStatus: payload.payment.status,
    total: Number(payload.total),
    cleaning: breakdown.cleaning,
    taxes: breakdown.taxes,
    serviceFee: breakdown.serviceFee
  });

  const guestHtml = buildGuestConfirmationHtml({
    reservationNumber,
    guestName,
    listingTitle: payload.listing.title,
    listingPhoto: payload.listing.photos[0]?.url || null,
    address: `${payload.listing.address}, ${payload.listing.neighborhood}, ${payload.listing.city}`,
    checkIn: payload.checkIn,
    checkOut: payload.checkOut,
    guestsCount: payload.guestsCount,
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
