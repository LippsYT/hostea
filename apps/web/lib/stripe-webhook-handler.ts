import { PaymentStatus, ReservationStatus } from '@prisma/client';
import { deleteReservationHold } from '@/lib/calendar-holds';
import {
  createCloudbedsReservation,
  getCloudbedsMappingForListing,
  isCloudbedsEnabled
} from '@/lib/cloudbeds';
import { enqueueReservationPrintJob } from '@/lib/print-jobs';
import { confirmReservationPayment } from '@/lib/reservation-payment-confirmation';

const ensureThreadMessage = async (
  prisma: any,
  threadId: string | undefined,
  senderId: string,
  body: string
) => {
  if (!threadId) return;
  const existing = await prisma.message.findFirst({
    where: { threadId, senderId, body },
    orderBy: { createdAt: 'desc' }
  });
  if (existing) return;
  await prisma.message.create({
    data: {
      threadId,
      senderId,
      body
    }
  });
};

const enqueuePaidPrint = async (prisma: any, reservationId: string) => {
  await enqueueReservationPrintJob(prisma, reservationId, 'paid');
};

const syncCloudbedsAfterPayment = async (
  prisma: any,
  input: {
    reservationId: string;
    listingId: string;
    userId: string;
    checkIn: Date;
    checkOut: Date;
    guestsCount: number;
    guestName: string;
    guestEmail: string;
  }
) => {
  if (!isCloudbedsEnabled() || !getCloudbedsMappingForListing(input.listingId)) {
    return;
  }

  try {
    const cloudbeds = await createCloudbedsReservation({
      listingId: input.listingId,
      reservationId: input.reservationId,
      checkIn: input.checkIn,
      checkOut: input.checkOut,
      guests: input.guestsCount,
      guestName: input.guestName,
      guestEmail: input.guestEmail
    });

    await prisma.auditLog.create({
      data: {
        actorId: input.userId,
        action: 'CLOUDBEDS_RESERVATION_CREATED',
        entity: 'Reservation',
        entityId: input.reservationId,
        meta: { externalId: cloudbeds.externalId, raw: cloudbeds.raw }
      }
    });
  } catch (error: any) {
    await prisma.auditLog.create({
      data: {
        actorId: input.userId,
        action: 'CLOUDBEDS_RESERVATION_FAILED',
        entity: 'Reservation',
        entityId: input.reservationId,
        meta: { error: error?.message || 'Cloudbeds sync error' }
      }
    });
  }
};

export const handleStripeWebhook = async (event: any, prisma: any) => {
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as any;
    const reservationId = session.metadata?.reservationId;
    const offerId = session.metadata?.offerId;

    if (offerId) {
      const offer = await prisma.offer.findUnique({
        where: { id: offerId },
        include: {
          thread: true,
          listing: true,
          guest: { include: { profile: true } },
          reservation: true
        }
      });

      if (!offer) {
        console.warn('stripe-webhook-offer-not-found', { offerId });
        return;
      }

      if (offer.status === 'PAID' && offer.reservationId) {
        return;
      }

      const total = Number(offer.clientTotal);
      const reservation =
        offer.reservation ||
        (await prisma.reservation.create({
          data: {
            listingId: offer.listingId,
            userId: offer.guestId,
            checkIn: offer.checkIn,
            checkOut: offer.checkOut,
            guestsCount: offer.guestsCount,
            total,
            currency: offer.currency || 'USD',
            status: ReservationStatus.AWAITING_PAYMENT,
            paymentExpiresAt: null,
            holdExpiresAt: null
          }
        }));

      const normalizedReservation = await prisma.reservation.update({
        where: { id: reservation.id },
        data: {
          checkIn: offer.checkIn,
          checkOut: offer.checkOut,
          guestsCount: offer.guestsCount,
          total,
          currency: offer.currency || 'USD',
          paymentExpiresAt: null,
          holdExpiresAt: null
        }
      });

      await prisma.offer.update({
        where: { id: offer.id },
        data: {
          status: 'PAID',
          paidAt: new Date(),
          reservationId: reservation.id
        }
      });

      await prisma.messageThread.update({
        where: { id: offer.threadId },
        data: {
          reservationId: reservation.id,
          status: 'RESERVATION',
          offerTotal: offer.clientTotal,
          offerCurrency: offer.currency || 'USD',
          offerExpiresAt: null
        }
      });

      await confirmReservationPayment(
        {
          reservationId: reservation.id,
          stripeSessionId: session.id || null,
          stripePaymentIntentId: session.payment_intent || null,
          triggerPush: true
        },
        prisma
      );

      await prisma.calendarBlock.deleteMany({
        where: { listingId: offer.listingId, createdBy: `offer:${offer.id}` }
      });
      await deleteReservationHold(reservation.id, prisma).catch(() => undefined);
      await ensureThreadMessage(
        prisma,
        offer.thread?.id,
        offer.listing.hostId,
        'Oferta pagada y reserva confirmada.'
      );

      try {
        await enqueuePaidPrint(prisma, reservation.id);
      } catch {}

      await syncCloudbedsAfterPayment(prisma, {
        reservationId: normalizedReservation.id,
        listingId: normalizedReservation.listingId,
        userId: offer.guestId,
        checkIn: normalizedReservation.checkIn,
        checkOut: normalizedReservation.checkOut,
        guestsCount: normalizedReservation.guestsCount,
        guestName: offer.guest.profile?.name || offer.guest.email.split('@')[0] || 'Huesped Hostea',
        guestEmail: offer.guest.email
      });

      return;
    }

    if (reservationId) {
      const confirmation = await confirmReservationPayment(
        {
          reservationId,
          stripeSessionId: session.id || null,
          stripePaymentIntentId: session.payment_intent || null,
          triggerPush: true
        },
        prisma
      );
      if (!confirmation.ok) {
        console.warn('stripe-webhook-confirmation-skipped', {
          reservationId,
          reason: confirmation.reason
        });
        return;
      }

      const reservation = await prisma.reservation.findUnique({
        where: { id: reservationId },
        include: {
          listing: true,
          user: { include: { profile: true } }
        }
      });
      if (!reservation) return;

      try {
        await enqueuePaidPrint(prisma, reservation.id);
      } catch {}

      await syncCloudbedsAfterPayment(prisma, {
        reservationId: reservation.id,
        listingId: reservation.listingId,
        userId: reservation.userId,
        checkIn: reservation.checkIn,
        checkOut: reservation.checkOut,
        guestsCount: reservation.guestsCount,
        guestName:
          reservation.user.profile?.name || reservation.user.email.split('@')[0] || 'Huesped Hostea',
        guestEmail: reservation.user.email
      });
      return;
    }

    console.warn('stripe-webhook-session-without-reservation', {
      sessionId: session.id,
      metadata: session.metadata || null
    });
  }

  if (event.type === 'charge.refunded') {
    const charge = event.data.object as any;
    const payment = await prisma.payment.findFirst({
      where: { stripePaymentIntentId: charge.payment_intent }
    });
    if (payment) {
      await prisma.payment.update({
        where: { id: payment.id },
        data: { status: PaymentStatus.REFUNDED }
      });
      await prisma.reservation.update({
        where: { id: payment.reservationId },
        data: { status: ReservationStatus.REFUNDED }
      });
    }
  }

  if (event.type === 'checkout.session.expired') {
    const session = event.data.object as any;
    const reservationId = session.metadata?.reservationId;
    const offerId = session.metadata?.offerId;
    if (offerId) {
      const offer = await prisma.offer.findUnique({ where: { id: offerId } });
      if (offer) {
        await prisma.$transaction(async (tx: any) => {
          await tx.offer.update({
            where: { id: offerId },
            data: { status: 'EXPIRED' }
          });
          if (offer.reservationId) {
            await tx.reservation.updateMany({
              where: {
                id: offer.reservationId,
                status: { in: [ReservationStatus.AWAITING_PAYMENT, ReservationStatus.PENDING_PAYMENT] }
              },
              data: {
                status: ReservationStatus.EXPIRED,
                paymentExpiresAt: null,
                holdExpiresAt: null
              }
            });
            await tx.payment.updateMany({
              where: { reservationId: offer.reservationId, status: PaymentStatus.REQUIRES_ACTION },
              data: { status: PaymentStatus.FAILED }
            });
            await deleteReservationHold(offer.reservationId, tx);
          }
          await tx.calendarBlock.deleteMany({
            where: { listingId: offer.listingId, createdBy: `offer:${offerId}` }
          });
        });
      }
    }
    if (reservationId) {
      await prisma.payment.updateMany({
        where: { reservationId },
        data: { status: PaymentStatus.FAILED }
      });
      const reservation = await prisma.reservation.update({
        where: { id: reservationId },
        data: {
          status: ReservationStatus.EXPIRED,
          paymentExpiresAt: null,
          holdExpiresAt: null
        },
        include: { listing: true, thread: true }
      });
      await deleteReservationHold(reservation.id, prisma);
      if (reservation.thread?.id) {
        await prisma.messageThread.update({
          where: { id: reservation.thread.id },
          data: { status: 'REJECTED' }
        });
        await ensureThreadMessage(
          prisma,
          reservation.thread.id,
          reservation.listing.hostId,
          'La solicitud vencio.'
        );
      }
    }
  }

  if (event.type === 'payment_intent.payment_failed' || event.type === 'payment_intent.canceled') {
    const intent = event.data.object as any;
    const payment = await prisma.payment.findFirst({ where: { stripePaymentIntentId: intent.id } });
    if (payment) {
      await prisma.payment.update({
        where: { id: payment.id },
        data: { status: PaymentStatus.FAILED }
      });
      const reservation = await prisma.reservation.update({
        where: { id: payment.reservationId },
        data: {
          status: ReservationStatus.EXPIRED,
          paymentExpiresAt: null,
          holdExpiresAt: null
        },
        include: { listing: true, thread: true }
      });
      await deleteReservationHold(reservation.id, prisma);
      if (reservation.thread?.id) {
        await prisma.messageThread.update({
          where: { id: reservation.thread.id },
          data: { status: 'REJECTED' }
        });
        await ensureThreadMessage(
          prisma,
          reservation.thread.id,
          reservation.listing.hostId,
          'La solicitud vencio.'
        );
      }
    }
  }
};
