import { PaymentStatus, ReservationStatus } from '@prisma/client';
import { sendAutoMessagesOnConfirm } from '@/lib/auto-messages';
import { sendPushToHost } from '@/lib/push-notifications';
import { deleteReservationHold } from '@/lib/calendar-holds';
import {
  createCloudbedsReservation,
  getCloudbedsMappingForListing,
  isCloudbedsEnabled
} from '@/lib/cloudbeds';

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
            paymentExpiresAt: null,
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
        await sendPushToHost(
          offer.listing.hostId,
          {
            title: 'Pago confirmado',
            body: `Oferta pagada y reserva confirmada en ${offer.listing.title}.`,
            url: `/dashboard/host/reservations?reservationId=${reservation.id}`,
            type: 'PAYMENT_CONFIRMED'
          },
          prisma
        );

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
        data: {
          status: ReservationStatus.CONFIRMED,
          paymentExpiresAt: null,
          holdExpiresAt: null
        }
      });

      const reservation = await prisma.reservation.findUnique({
        where: { id: reservationId },
        include: {
          listing: true,
          user: { include: { profile: true } },
          thread: true
        }
      });
      if (reservation) {
        await deleteReservationHold(reservation.id, prisma);

        if (reservation.thread?.id) {
          await prisma.messageThread.update({
            where: { id: reservation.thread.id },
            data: { status: 'RESERVATION' }
          });
          await ensureThreadMessage(
            prisma,
            reservation.thread.id,
            reservation.listing.hostId,
            '✅ Reserva confirmada.'
          );
        }

        await sendAutoMessagesOnConfirm(reservation.id);
        await sendPushToHost(
          reservation.listing.hostId,
          {
            title: 'Pago confirmado',
            body: `Nueva reserva confirmada en ${reservation.listing.title}.`,
            url: `/dashboard/host/reservations?reservationId=${reservation.id}`,
            type: 'PAYMENT_CONFIRMED'
          },
          prisma
        );

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
          '⏳ La solicitud venció.'
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
          '⏳ La solicitud venció.'
        );
      }
    }
  }
};
