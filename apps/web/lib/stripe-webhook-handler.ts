import { PaymentStatus, ReservationStatus } from '@prisma/client';
import { sendAutoMessagesOnConfirm } from '@/lib/auto-messages';
import {
  createCloudbedsReservation,
  getCloudbedsMappingForListing,
  isCloudbedsEnabled
} from '@/lib/cloudbeds';

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
          guest: { include: { profile: true } }
        }
      });
      if (offer && offer.status !== 'PAID') {
        const total = Number(offer.clientTotal);
        const reservation = await prisma.reservation.create({
          data: {
            listingId: offer.listingId,
            userId: offer.guestId,
            checkIn: offer.checkIn,
            checkOut: offer.checkOut,
            guestsCount: offer.guestsCount,
            total,
            currency: offer.currency || 'USD',
            status: ReservationStatus.CONFIRMED,
            holdExpiresAt: null
          }
        });

        await prisma.payment.create({
          data: {
            reservationId: reservation.id,
            userId: offer.guestId,
            stripeSessionId: session.id,
            stripePaymentIntentId: session.payment_intent,
            amount: total,
            currency: offer.currency || 'USD',
            status: PaymentStatus.SUCCEEDED
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

        await prisma.calendarBlock.deleteMany({
          where: { listingId: offer.listingId, createdBy: `offer:${offer.id}` }
        });
        await prisma.calendarBlock.create({
          data: {
            listingId: offer.listingId,
            startDate: offer.checkIn,
            endDate: offer.checkOut,
            reason: 'Reserva confirmada (oferta especial)',
            createdBy: offer.guestId
          }
        });

        if (!offer.thread.reservationId) {
          await prisma.messageThread.update({
            where: { id: offer.threadId },
            data: {
              reservationId: reservation.id,
              status: 'RESERVATION',
              offerTotal: offer.clientTotal,
              offerCurrency: offer.currency || 'USD'
            }
          });
        }

        await sendAutoMessagesOnConfirm(reservation.id);

        if (isCloudbedsEnabled() && getCloudbedsMappingForListing(reservation.listingId)) {
          try {
            const cloudbeds = await createCloudbedsReservation({
              listingId: reservation.listingId,
              reservationId: reservation.id,
              checkIn: reservation.checkIn,
              checkOut: reservation.checkOut,
              guests: reservation.guestsCount,
              guestName:
                offer.guest.profile?.name ||
                offer.guest.email.split('@')[0] ||
                'Huesped Hostea',
              guestEmail: offer.guest.email
            });

            await prisma.auditLog.create({
              data: {
                actorId: offer.guestId,
                action: 'CLOUDBEDS_RESERVATION_CREATED',
                entity: 'Reservation',
                entityId: reservation.id,
                meta: { externalId: cloudbeds.externalId, raw: cloudbeds.raw }
              }
            });
          } catch (error: any) {
            await prisma.auditLog.create({
              data: {
                actorId: offer.guestId,
                action: 'CLOUDBEDS_RESERVATION_FAILED',
                entity: 'Reservation',
                entityId: reservation.id,
                meta: { error: error?.message || 'Cloudbeds sync error' }
              }
            });
          }
        }
      }
    }
    if (reservationId) {
      await prisma.payment.updateMany({
        where: { reservationId },
        data: {
          status: PaymentStatus.SUCCEEDED,
          stripePaymentIntentId: session.payment_intent
        }
      });
      await prisma.reservation.update({
        where: { id: reservationId },
        data: { status: ReservationStatus.CONFIRMED, holdExpiresAt: null }
      });

      const reservation = await prisma.reservation.findUnique({
        where: { id: reservationId },
        include: {
          listing: true,
          user: { include: { profile: true } }
        }
      });
      if (reservation) {
        await prisma.calendarBlock.create({
          data: {
            listingId: reservation.listingId,
            startDate: reservation.checkIn,
            endDate: reservation.checkOut,
            reason: 'Reserva confirmada',
            createdBy: reservation.userId
          }
        });
        await sendAutoMessagesOnConfirm(reservation.id);

        if (isCloudbedsEnabled() && getCloudbedsMappingForListing(reservation.listingId)) {
          try {
            const cloudbeds = await createCloudbedsReservation({
              listingId: reservation.listingId,
              reservationId: reservation.id,
              checkIn: reservation.checkIn,
              checkOut: reservation.checkOut,
              guests: reservation.guestsCount,
              guestName:
                reservation.user.profile?.name ||
                reservation.user.email.split('@')[0] ||
                'Huesped Hostea',
              guestEmail: reservation.user.email
            });

            await prisma.auditLog.create({
              data: {
                actorId: reservation.userId,
                action: 'CLOUDBEDS_RESERVATION_CREATED',
                entity: 'Reservation',
                entityId: reservation.id,
                meta: { externalId: cloudbeds.externalId, raw: cloudbeds.raw }
              }
            });
          } catch (error: any) {
            await prisma.auditLog.create({
              data: {
                actorId: reservation.userId,
                action: 'CLOUDBEDS_RESERVATION_FAILED',
                entity: 'Reservation',
                entityId: reservation.id,
                meta: { error: error?.message || 'Cloudbeds sync error' }
              }
            });
          }
        }
      }
    }
  }

  if (event.type === 'charge.refunded') {
    const charge = event.data.object as any;
    const payment = await prisma.payment.findFirst({ where: { stripePaymentIntentId: charge.payment_intent } });
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
        await prisma.offer.update({
          where: { id: offerId },
          data: { status: 'EXPIRED' }
        });
        await prisma.calendarBlock.deleteMany({
          where: { listingId: offer.listingId, createdBy: `offer:${offerId}` }
        });
      }
    }
    if (reservationId) {
      await prisma.payment.updateMany({
        where: { reservationId },
        data: { status: PaymentStatus.FAILED }
      });
      await prisma.reservation.update({
        where: { id: reservationId },
        data: { status: ReservationStatus.CANCELED, holdExpiresAt: null }
      });
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
      await prisma.reservation.update({
        where: { id: payment.reservationId },
        data: { status: ReservationStatus.CANCELED, holdExpiresAt: null }
      });
    }
  }
};
