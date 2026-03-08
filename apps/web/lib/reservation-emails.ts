import { addHours, differenceInCalendarDays, endOfDay, format, startOfDay, subHours } from 'date-fns';
import { PaymentStatus, ReservationStatus } from '@prisma/client';
import { prisma } from '@/lib/db';
import { calcBreakdown } from '@/lib/intelligent-pricing';
import { sendEmail } from '@/lib/email';
import { buildSimplePdfBuffer } from '@/lib/simple-pdf';
import { ensureReservationNumber } from '@/lib/reservation-number';

const money = (value: number) => `USD ${value.toFixed(2)}`;
const contactEmail = process.env.EMAIL_FROM_CONTACT || 'contacto@gohostea.com';

const safeText = (value: string | null | undefined, fallback = '-') =>
  (value || '').trim() || fallback;

const emailKey = (reservationId: string, type: string) => `reservationEmail:${type}:${reservationId}`;

const hasEmailBeenSent = async (key: string, db = prisma) => {
  const row = await db.settings.findUnique({ where: { key } });
  return Boolean(row);
};

const markEmailSent = async (key: string, db = prisma) => {
  await db.settings.upsert({
    where: { key },
    update: { value: true },
    create: { key, value: true }
  });
};

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
    `Tarifa base: ${money(Math.max(data.total - data.cleaning - data.taxes - data.serviceFee, 0))}`,
    `Limpieza: ${money(data.cleaning)}`,
    `Impuestos: ${money(data.taxes)}`,
    `Tarifa servicio Hostea: ${money(data.serviceFee)}`,
    `TOTAL PAGADO: ${money(data.total)}`,
    `Estado del pago: ${data.paymentStatus}`,
    '',
    `Soporte Hostea: ${contactEmail}`
  ];

  return buildSimplePdfBuffer(lines);
};

const buildGuestConfirmationHtml = (input: {
  reservationNumber: string;
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
  const image = input.listingPhoto
    ? `<img src="${input.listingPhoto}" alt="Alojamiento" style="width:100%;max-width:280px;border-radius:12px;display:block;margin:0 auto 16px;" />`
    : '';

  return `
    <div style="font-family:Arial,sans-serif;color:#0f172a;line-height:1.5">
      <h2 style="margin-bottom:8px;">HOSTEA - Reserva confirmada</h2>
      <p style="margin-top:0;">Numero de reserva: <strong>${input.reservationNumber}</strong></p>
      ${image}
      <p><strong>${input.listingTitle}</strong></p>
      <p>${input.address}</p>
      <ul>
        <li>Check-in: ${format(input.checkIn, 'yyyy-MM-dd')}</li>
        <li>Check-out: ${format(input.checkOut, 'yyyy-MM-dd')}</li>
        <li>Huespedes: ${input.guestsCount}</li>
        <li>Total pagado: ${money(input.total)}</li>
        <li>Estado del pago: ${input.paymentStatus}</li>
      </ul>
      <p><strong>Instrucciones check-in:</strong> ${safeText(input.checkInInstructions)}</p>
      <p><strong>Instrucciones check-out:</strong> ${safeText(input.checkOutInstructions)}</p>
      <p><strong>Asistencia:</strong> ${safeText(input.assistancePhone)}</p>
      <p><strong>Asistencia secundaria:</strong> ${safeText(input.assistancePhoneSecondary)}</p>
      <p>Te adjuntamos tu factura en PDF.</p>
      <p><a href="${input.reservationUrl}" style="display:inline-block;padding:10px 14px;background:#0f172a;color:#fff;text-decoration:none;border-radius:999px;">Ver reserva</a></p>
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
      <li>Check-in: ${format(input.checkIn, 'yyyy-MM-dd')}</li>
      <li>Check-out: ${format(input.checkOut, 'yyyy-MM-dd')}</li>
      <li>Total pagado: ${money(input.total)}</li>
      <li>Neto estimado anfitrion: ${money(input.hostNet)}</li>
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

export const sendReservationConfirmedEmails = async (reservationId: string, db = prisma) => {
  const payload = await getReservationPayload(reservationId, db);
  if (!payload) return;
  if (payload.payment?.status !== PaymentStatus.SUCCEEDED) return;

  const reservationNumber =
    payload.reservationNumber ||
    (await ensureReservationNumber(db, payload.id, payload.createdAt)) ||
    payload.id;
  const hostName = payload.listing.host.profile?.name || payload.listing.host.email;
  const guestName = payload.user.profile?.name || payload.user.email;
  const breakdown = buildInvoiceBreakdown(payload);
  const appUrl = process.env.APP_URL || process.env.NEXTAUTH_URL || 'https://gohostea.com';
  const reservationUrl = `${appUrl}/dashboard/client/reservations`;
  const panelUrl = `${appUrl}/dashboard/host/reservations?reservationId=${payload.id}`;

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
};

export const sendCheckInReminderEmail = async (reservationId: string, db = prisma) => {
  const payload = await getReservationPayload(reservationId, db);
  if (!payload || payload.payment?.status !== PaymentStatus.SUCCEEDED) return;
  const appUrl = process.env.APP_URL || process.env.NEXTAUTH_URL || 'https://gohostea.com';
  await sendEmail({
    to: payload.user.email,
    subject: 'Recordatorio de check-in (24h)',
    html: `
      <div style="font-family:Arial,sans-serif;color:#0f172a">
        <h2>Tu check-in es manana</h2>
        <p>Reserva: ${payload.reservationNumber || payload.id}</p>
        <p>Te compartimos la informacion importante para tu llegada.</p>
        <p><strong>Check-in:</strong> ${format(payload.checkIn, 'yyyy-MM-dd')} (${payload.listing.checkInTime})</p>
        <p><strong>Instrucciones:</strong> ${safeText(payload.listing.checkInInstructions)}</p>
        <p><strong>Asistencia:</strong> ${safeText(payload.listing.assistancePhone)}</p>
        <p><a href="${appUrl}/dashboard/client/reservations">Ver reserva</a></p>
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
        <p><a href="${process.env.APP_URL || 'https://gohostea.com'}/dashboard/client/reservations">Dejar una resena</a></p>
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
    if (await hasEmailBeenSent(key, db)) continue;
    await sendCheckInReminderEmail(row.id, db);
    await markEmailSent(key, db);
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
    if (await hasEmailBeenSent(key, db)) continue;
    await sendPostCheckoutEmail(row.id, db);
    await markEmailSent(key, db);
  }

  return {
    reminders: reminderRows.length,
    postCheckout: postCheckoutRows.length
  };
};
