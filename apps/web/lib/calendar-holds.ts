import { PaymentStatus, ReservationStatus } from '@prisma/client';
import { prisma } from '@/lib/db';

const EXPIRED_MESSAGE = 'La solicitud vencio.';

const ensureThreadMessageIfMissing = async (
  tx: any,
  threadId: string | null | undefined,
  senderId: string,
  body: string
) => {
  if (!threadId) return;
  const existing = await tx.message.findFirst({
    where: { threadId, senderId, body },
    orderBy: { createdAt: 'desc' }
  });
  if (existing) return;
  await tx.message.create({ data: { threadId, senderId, body } });
};

export const createOrRefreshReservationHold = async (
  args: {
    listingId: string;
    reservationId: string;
    checkIn: Date;
    checkOut: Date;
    expiresAt: Date;
  },
  tx: any = prisma
) => {
  await tx.calendarHold.upsert({
    where: { reservationId: args.reservationId },
    update: {
      listingId: args.listingId,
      startDate: args.checkIn,
      endDate: args.checkOut,
      expiresAt: args.expiresAt,
      source: 'CHECKOUT'
    },
    create: {
      listingId: args.listingId,
      reservationId: args.reservationId,
      startDate: args.checkIn,
      endDate: args.checkOut,
      expiresAt: args.expiresAt,
      source: 'CHECKOUT'
    }
  });
};

export const deleteReservationHold = async (
  reservationId: string,
  tx: any = prisma
) => {
  await tx.calendarHold.deleteMany({
    where: { reservationId }
  });
};

export const cleanupExpiredReservationHolds = async (
  tx: any = prisma
) => {
  const now = new Date();
  const expiredHolds = await tx.calendarHold.findMany({
    where: { expiresAt: { lte: now } },
    include: {
      reservation: {
        include: { payment: true, thread: true, listing: true }
      }
    }
  });
  if (!expiredHolds.length) return 0;

  for (const hold of expiredHolds) {
    const reservation = hold.reservation;
    if (
      reservation &&
      [ReservationStatus.AWAITING_PAYMENT, ReservationStatus.PENDING_PAYMENT].includes(
        reservation.status
      )
    ) {
      await tx.reservation.update({
        where: { id: reservation.id },
        data: {
          status: ReservationStatus.EXPIRED,
          paymentExpiresAt: null,
          holdExpiresAt: null
        }
      });

      if (reservation.payment && reservation.payment.status === PaymentStatus.REQUIRES_ACTION) {
        await tx.payment.update({
          where: { id: reservation.payment.id },
          data: { status: PaymentStatus.FAILED }
        });
      }

      if (reservation.thread?.id) {
        await tx.messageThread.update({
          where: { id: reservation.thread.id },
          data: { status: 'REJECTED' }
        });
        await ensureThreadMessageIfMissing(
          tx,
          reservation.thread.id,
          reservation.listing.hostId,
          EXPIRED_MESSAGE
        );
      }
    }
  }

  await tx.calendarHold.deleteMany({
    where: { expiresAt: { lte: now } }
  });

  return expiredHolds.length;
};
