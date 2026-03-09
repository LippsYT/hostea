import { PaymentStatus, ReservationStatus } from '@prisma/client';
import { prisma } from '@/lib/db';
import { ensureReservationNumber } from '@/lib/reservation-number';
import { deleteReservationHold } from '@/lib/calendar-holds';
import { sendAutoMessagesOnConfirm } from '@/lib/auto-messages';
import { sendReservationConfirmedEmails } from '@/lib/reservation-emails';
import { sendPushToHost } from '@/lib/push-notifications';

const CONFIRMABLE_RESERVATION_STATUSES = new Set<ReservationStatus>([
  ReservationStatus.CONFIRMED,
  ReservationStatus.CHECKED_IN,
  ReservationStatus.COMPLETED
]);

let paymentConfirmedAtColumnCache: boolean | null = null;

const hasPaymentConfirmedAtColumn = async (db: any) => {
  if (paymentConfirmedAtColumnCache !== null) return paymentConfirmedAtColumnCache;
  try {
    const rows = (await db.$queryRawUnsafe(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'Reservation'
        AND column_name = 'payment_confirmed_at'
      LIMIT 1
    `)) as Array<{ column_name: string }>;
    paymentConfirmedAtColumnCache = rows.length > 0;
    return paymentConfirmedAtColumnCache;
  } catch {
    paymentConfirmedAtColumnCache = false;
    return false;
  }
};

const markPaymentConfirmedAt = async (reservationId: string, db: any) => {
  if (!(await hasPaymentConfirmedAtColumn(db))) return;
  try {
    await db.$executeRawUnsafe(
      `
        UPDATE public."Reservation"
        SET "payment_confirmed_at" = NOW(),
            "updatedAt" = NOW()
        WHERE id = $1
      `,
      reservationId
    );
  } catch {
    // Non-blocking metadata update.
  }
};

const ensureThreadMessage = async (
  db: any,
  threadId: string | undefined,
  senderId: string,
  body: string
) => {
  if (!threadId) return;
  const existing = await db.message.findFirst({
    where: { threadId, senderId, body },
    orderBy: { createdAt: 'desc' }
  });
  if (existing) return;
  await db.message.create({
    data: {
      threadId,
      senderId,
      body
    }
  });
};

export const confirmReservationPayment = async (
  input: {
    reservationId: string;
    stripeSessionId?: string | null;
    stripePaymentIntentId?: string | null;
    triggerPush?: boolean;
  },
  db = prisma
) => {
  console.info('reservation-payment-confirmation:start', {
    reservationId: input.reservationId,
    hasStripeSessionId: Boolean(input.stripeSessionId),
    hasPaymentIntentId: Boolean(input.stripePaymentIntentId)
  });

  const reservation = await db.reservation.findUnique({
    where: { id: input.reservationId },
    include: {
      listing: true,
      user: { include: { profile: true } },
      payment: true,
      thread: true
    }
  });

  if (!reservation) {
    console.warn('reservation-payment-confirmation:not-found', {
      reservationId: input.reservationId
    });
    return { ok: false as const, reason: 'not-found' as const };
  }

  const alreadyConfirmed =
    CONFIRMABLE_RESERVATION_STATUSES.has(reservation.status) &&
    reservation.payment?.status === PaymentStatus.SUCCEEDED;

  const stripeSessionId = input.stripeSessionId || reservation.payment?.stripeSessionId || null;
  const stripePaymentIntentId =
    input.stripePaymentIntentId || reservation.payment?.stripePaymentIntentId || null;

  if (!alreadyConfirmed) {
    await db.payment.upsert({
      where: { reservationId: reservation.id },
      create: {
        reservationId: reservation.id,
        userId: reservation.userId,
        stripeSessionId,
        stripePaymentIntentId,
        amount: reservation.total,
        currency: reservation.currency || 'USD',
        status: PaymentStatus.SUCCEEDED
      },
      update: {
        stripeSessionId: stripeSessionId || undefined,
        stripePaymentIntentId: stripePaymentIntentId || undefined,
        amount: reservation.total,
        currency: reservation.currency || 'USD',
        status: PaymentStatus.SUCCEEDED
      }
    });

    await db.reservation.update({
      where: { id: reservation.id },
      data: {
        status: ReservationStatus.CONFIRMED,
        paymentExpiresAt: null,
        holdExpiresAt: null
      }
    });
  }

  await markPaymentConfirmedAt(reservation.id, db);
  await ensureReservationNumber(db, reservation.id, reservation.createdAt);
  await deleteReservationHold(reservation.id, db).catch(() => undefined);

  if (reservation.thread?.id) {
    await db.messageThread.update({
      where: { id: reservation.thread.id },
      data: { status: 'RESERVATION' }
    });
    await ensureThreadMessage(db, reservation.thread.id, reservation.listing.hostId, 'Reserva confirmada.');
  }

  await sendAutoMessagesOnConfirm(reservation.id);
  const emailResult = await sendReservationConfirmedEmails(reservation.id, db);
  if (!emailResult.sent) {
    console.error('reservation-payment-confirmation:email-not-sent', {
      reservationId: reservation.id,
      reason: emailResult.reason
    });
  }

  if (input.triggerPush !== false) {
    await sendPushToHost(
      reservation.listing.hostId,
      {
        title: 'Pago confirmado',
        body: `Nueva reserva confirmada en ${reservation.listing.title}.`,
        url: `/dashboard/host/reservations?reservationId=${reservation.id}`,
        type: 'PAYMENT_CONFIRMED'
      },
      db
    ).catch(() => undefined);
  }

  return {
    ok: true as const,
    alreadyConfirmed,
    reservationId: reservation.id,
    email: emailResult
  };
};
