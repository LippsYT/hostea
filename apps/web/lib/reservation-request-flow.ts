import { PaymentStatus, ReservationStatus } from '@prisma/client';
import { prisma } from '@/lib/db';
import {
  cleanupExpiredReservationHolds,
  createOrRefreshReservationHold,
  deleteReservationHold
} from '@/lib/calendar-holds';
import { checkListingAvailability } from '@/lib/listing-availability';
import { sendPushToClient, sendPushToHost } from '@/lib/push-notifications';
import {
  getReservationWorkflowStatus,
  isPendingApprovalReservation
} from '@/lib/reservation-workflow';

const PAYMENT_WINDOW_MINUTES = 30;

export const buildPaymentExpiresAt = () =>
  new Date(Date.now() + PAYMENT_WINDOW_MINUTES * 60 * 1000);

const APPROVED_MESSAGE = 'Solicitud aprobada. Tenes 30 min para pagar y confirmar.';
const REJECTED_MESSAGE = 'Solicitud rechazada.';
const EXPIRED_MESSAGE = 'La solicitud vencio.';

const createThreadMessageIfMissing = async (
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

export const approveReservationRequest = async (reservationId: string, actorId: string) => {
  const reservation = await prisma.reservation.findUnique({
    where: { id: reservationId },
    include: { listing: true, payment: true, thread: true }
  });
  if (!reservation) {
    throw new Error('No encontrado');
  }

  if (reservation.listing.hostId !== actorId) {
    throw new Error('No autorizado');
  }

  if (
    !isPendingApprovalReservation({
      status: reservation.status,
      paymentExpiresAt: reservation.paymentExpiresAt,
      holdExpiresAt: reservation.holdExpiresAt,
      paymentStatus: reservation.payment?.status || null
    })
  ) {
    throw new Error('La reserva no esta pendiente de aprobacion');
  }

  const availability = await checkListingAvailability({
    listingId: reservation.listingId,
    checkIn: reservation.checkIn,
    checkOut: reservation.checkOut,
    guests: reservation.guestsCount,
    excludeReservationId: reservation.id
  });

  if (!availability.available) {
    throw new Error(availability.message || 'Ya no hay cupo para esas fechas.');
  }

  const paymentExpiresAt = buildPaymentExpiresAt();

  const updated = await prisma.$transaction(async (tx) => {
    const nextReservation = await tx.reservation.update({
      where: { id: reservation.id },
      data: {
        status: ReservationStatus.AWAITING_PAYMENT,
        paymentExpiresAt,
        holdExpiresAt: paymentExpiresAt
      }
    });

    await createOrRefreshReservationHold(
      {
        listingId: reservation.listingId,
        reservationId: reservation.id,
        checkIn: reservation.checkIn,
        checkOut: reservation.checkOut,
        expiresAt: paymentExpiresAt
      },
      tx
    );

    if (reservation.thread?.id) {
      await tx.messageThread.update({
        where: { id: reservation.thread.id },
        data: { status: 'PREAPPROVED' }
      });
      await createThreadMessageIfMissing(tx, reservation.thread.id, actorId, APPROVED_MESSAGE);
    }

    await tx.auditLog.create({
      data: {
        actorId,
        action: 'RESERVATION_APPROVED_FOR_PAYMENT',
        entity: 'Reservation',
        entityId: reservation.id,
        meta: {
          approvedBy: actorId,
          approvedAt: new Date(),
          paymentExpiresAt
        }
      }
    });

    return nextReservation;
  });

  await sendPushToClient(
    reservation.userId,
    {
      title: 'Solicitud aprobada',
      body: 'Tu solicitud fue aprobada. Tenes 30 minutos para pagar.',
      url: reservation.thread?.id
        ? `/dashboard/client/messages?threadId=${reservation.thread.id}`
        : '/dashboard/client/messages',
      type: 'RESERVATION_APPROVED'
    },
    prisma
  );

  return { reservation: updated, paymentExpiresAt };
};

export const rejectReservationRequest = async (
  reservationId: string,
  actorId: string,
  reason?: string
) => {
  const reservation = await prisma.reservation.findUnique({
    where: { id: reservationId },
    include: { listing: true, payment: true, thread: true }
  });
  if (!reservation) {
    throw new Error('No encontrado');
  }

  if (reservation.listing.hostId !== actorId) {
    throw new Error('No autorizado');
  }

  if (
    !isPendingApprovalReservation({
      status: reservation.status,
      paymentExpiresAt: reservation.paymentExpiresAt,
      holdExpiresAt: reservation.holdExpiresAt,
      paymentStatus: reservation.payment?.status || null
    })
  ) {
    throw new Error('La reserva no esta pendiente de aprobacion');
  }

  const updated = await prisma.$transaction(async (tx) => {
    const nextReservation = await tx.reservation.update({
      where: { id: reservation.id },
      data: {
        status: ReservationStatus.REJECTED,
        paymentExpiresAt: null,
        holdExpiresAt: null
      }
    });

    await deleteReservationHold(reservation.id, tx);

    if (reservation.thread?.id) {
      await tx.messageThread.update({
        where: { id: reservation.thread.id },
        data: { status: 'REJECTED' }
      });
      await createThreadMessageIfMissing(tx, reservation.thread.id, actorId, REJECTED_MESSAGE);
    }

    await tx.auditLog.create({
      data: {
        actorId,
        action: 'RESERVATION_REJECTED',
        entity: 'Reservation',
        entityId: reservation.id,
        meta: { rejectedAt: new Date(), reason: reason || null }
      }
    });

    return nextReservation;
  });

  await sendPushToClient(
    reservation.userId,
    {
      title: 'Solicitud rechazada',
      body: 'El anfitrion rechazo la solicitud.',
      url: reservation.thread?.id
        ? `/dashboard/client/messages?threadId=${reservation.thread.id}`
        : '/dashboard/client/messages',
      type: 'RESERVATION_REJECTED'
    },
    prisma
  );

  return { reservation: updated };
};

export const clientRejectAwaitingPayment = async (reservationId: string, actorId: string) => {
  const reservation = await prisma.reservation.findUnique({
    where: { id: reservationId },
    include: { listing: true, payment: true, thread: true }
  });
  if (!reservation) {
    throw new Error('No encontrado');
  }
  if (reservation.userId !== actorId) {
    throw new Error('No autorizado');
  }

  const workflow = getReservationWorkflowStatus({
    status: reservation.status,
    paymentExpiresAt: reservation.paymentExpiresAt,
    holdExpiresAt: reservation.holdExpiresAt,
    paymentStatus: reservation.payment?.status || null
  });
  if (workflow !== 'awaiting_payment') {
    throw new Error('La solicitud no esta esperando pago');
  }

  await prisma.$transaction(async (tx) => {
    await tx.reservation.update({
      where: { id: reservation.id },
      data: {
        status: ReservationStatus.REJECTED,
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
      await createThreadMessageIfMissing(
        tx,
        reservation.thread.id,
        actorId,
        'Solicitud rechazada por el huesped.'
      );
    }

    await deleteReservationHold(reservation.id, tx);
  });

  await sendPushToHost(
    reservation.listing.hostId,
    {
      title: 'Solicitud rechazada',
      body: 'El huesped rechazo la solicitud antes de pagar.',
      url: reservation.thread?.id
        ? `/dashboard/host/messages?threadId=${reservation.thread.id}`
        : '/dashboard/host/messages',
      type: 'RESERVATION_REJECTED'
    },
    prisma
  );
};

export const expireAwaitingPaymentReservations = async () => {
  const holdsExpired = await cleanupExpiredReservationHolds(prisma);
  const now = new Date();
  const expired = await prisma.reservation.findMany({
    where: {
      status: { in: [ReservationStatus.AWAITING_PAYMENT, ReservationStatus.PENDING_PAYMENT] },
      OR: [{ paymentExpiresAt: { lte: now } }, { holdExpiresAt: { lte: now } }]
    },
    include: {
      payment: true,
      thread: true,
      listing: true
    }
  });

  if (!expired.length) {
    return holdsExpired;
  }

  for (const reservation of expired) {
    const workflow = getReservationWorkflowStatus({
      status: reservation.status,
      paymentExpiresAt: reservation.paymentExpiresAt,
      holdExpiresAt: reservation.holdExpiresAt,
      paymentStatus: reservation.payment?.status || null,
      now
    });

    if (workflow !== 'awaiting_payment' && workflow !== 'expired') {
      continue;
    }

    await prisma.$transaction(async (tx) => {
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

      await deleteReservationHold(reservation.id, tx);

      if (reservation.thread?.id) {
        await tx.messageThread.update({
          where: { id: reservation.thread.id },
          data: { status: 'REJECTED' }
        });
        await createThreadMessageIfMissing(
          tx,
          reservation.thread.id,
          reservation.listing.hostId,
          EXPIRED_MESSAGE
        );
      }
    });

    await sendPushToClient(
      reservation.userId,
      {
        title: 'Solicitud vencida',
        body: 'La solicitud vencio porque no se completo el pago a tiempo.',
        url: reservation.thread?.id
          ? `/dashboard/client/messages?threadId=${reservation.thread.id}`
          : '/dashboard/client/messages',
        type: 'RESERVATION_EXPIRED'
      },
      prisma
    );

    await sendPushToHost(
      reservation.listing.hostId,
      {
        title: 'Solicitud vencida',
        body: 'Una solicitud aprobada vencio sin pago.',
        url: reservation.thread?.id
          ? `/dashboard/host/messages?threadId=${reservation.thread.id}`
          : '/dashboard/host/messages',
        type: 'RESERVATION_EXPIRED'
      },
      prisma
    );
  }

  return holdsExpired + expired.length;
};
