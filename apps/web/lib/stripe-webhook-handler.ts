import { PaymentStatus, ReservationStatus, ThreadType } from '@prisma/client';

export const handleStripeWebhook = async (event: any, prisma: any) => {
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as any;
    const reservationId = session.metadata?.reservationId;
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
        data: { status: ReservationStatus.CONFIRMED }
      });

      const reservation = await prisma.reservation.findUnique({
        where: { id: reservationId },
        include: { listing: true }
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

        const thread = await prisma.messageThread.create({
          data: {
            type: ThreadType.RESERVATION,
            status: 'RESERVATION',
            reservationId: reservation.id,
            createdById: reservation.userId,
            participants: {
              create: [
                { userId: reservation.userId },
                { userId: reservation.listing.hostId }
              ]
            }
          }
        });

        await prisma.message.create({
          data: {
            threadId: thread.id,
            senderId: reservation.listing.hostId,
            body: '¡Gracias por reservar! Estoy disponible para coordinar tu llegada.'
          }
        });
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
};
