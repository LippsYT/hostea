import { PaymentStatus, ReservationStatus } from '@prisma/client';
import { sendAutoMessagesOnConfirm } from '@/lib/auto-messages';

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
        data: { status: ReservationStatus.CONFIRMED, holdExpiresAt: null }
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
        await sendAutoMessagesOnConfirm(reservation.id);
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
