import { NextResponse } from 'next/server';
import { PaymentStatus } from '@prisma/client';
import { assertCsrf } from '@/lib/csrf';
import { prisma } from '@/lib/db';
import { requireSession } from '@/lib/permissions';
import { rateLimit } from '@/lib/rate-limit';
import { stripe } from '@/lib/stripe';
import { checkListingAvailability } from '@/lib/listing-availability';
import {
  expireAwaitingPaymentReservations
} from '@/lib/reservation-request-flow';
import { createOrRefreshReservationHold } from '@/lib/calendar-holds';
import { getReservationWorkflowStatus } from '@/lib/reservation-workflow';
import { sendPushToHost } from '@/lib/push-notifications';

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  try {
    assertCsrf(_req);
    const session = await requireSession();
    const userId = (session.user as any).id as string;

    const ok = await rateLimit(`reservation:pay:${userId}`, 10, 60);
    if (!ok) {
      return NextResponse.json({ error: 'Rate limit' }, { status: 429 });
    }

    await expireAwaitingPaymentReservations();

    const reservation = await prisma.reservation.findUnique({
      where: { id: params.id },
      include: { listing: true, payment: true, thread: true }
    });
    if (!reservation) {
      return NextResponse.json({ error: 'Reserva no encontrada' }, { status: 404 });
    }
    if (reservation.userId !== userId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const workflowStatus = getReservationWorkflowStatus({
      status: reservation.status,
      paymentExpiresAt: reservation.paymentExpiresAt,
      holdExpiresAt: reservation.holdExpiresAt,
      paymentStatus: reservation.payment?.status || null
    });

    if (workflowStatus !== 'awaiting_payment') {
      if (workflowStatus === 'expired') {
        return NextResponse.json({ error: 'La solicitud ya vencio' }, { status: 410 });
      }
      return NextResponse.json({ error: 'La reserva aun no esta lista para pago' }, { status: 409 });
    }

    const availability = await checkListingAvailability({
      listingId: reservation.listingId,
      checkIn: reservation.checkIn,
      checkOut: reservation.checkOut,
      guests: reservation.guestsCount,
      excludeReservationId: reservation.id
    });
    if (!availability.available) {
      return NextResponse.json(
        { error: availability.message || 'Fechas no disponibles para completar esta reserva' },
        { status: 409 }
      );
    }

    const expiresAt =
      reservation.paymentExpiresAt ||
      reservation.holdExpiresAt ||
      new Date(Date.now() + 30 * 60 * 1000);
    await createOrRefreshReservationHold({
      listingId: reservation.listingId,
      reservationId: reservation.id,
      checkIn: reservation.checkIn,
      checkOut: reservation.checkOut,
      expiresAt
    });

    const amount = Number(reservation.total);
    const stripeSession = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      success_url: `${process.env.APP_URL}/success?reservationId=${reservation.id}`,
      cancel_url: `${process.env.APP_URL}/cancel?reservationId=${reservation.id}`,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: { name: reservation.listing.title },
            unit_amount: Math.round(amount * 100)
          },
          quantity: 1
        }
      ],
      metadata: { reservationId: reservation.id, kind: 'reservation_approval_payment' }
    });

    if (!stripeSession.url) {
      return NextResponse.json({ error: 'No se pudo iniciar checkout' }, { status: 500 });
    }

    if (reservation.payment) {
      await prisma.payment.update({
        where: { id: reservation.payment.id },
        data: {
          stripeSessionId: stripeSession.id,
          amount,
          currency: reservation.currency || 'USD',
          status: PaymentStatus.REQUIRES_ACTION
        }
      });
    } else {
      await prisma.payment.create({
        data: {
          reservationId: reservation.id,
          userId: reservation.userId,
          stripeSessionId: stripeSession.id,
          amount,
          currency: reservation.currency || 'USD',
          status: PaymentStatus.REQUIRES_ACTION
        }
      });
    }

    if (reservation.thread?.id) {
      await prisma.message.create({
        data: {
          threadId: reservation.thread.id,
          senderId: reservation.userId,
          body: 'Inicie el pago de la solicitud para confirmar la reserva.'
        }
      });
    }

    await sendPushToHost(
      reservation.listing.hostId,
      {
        title: 'Pago en proceso',
        body: 'El cliente inicio el checkout de una solicitud aprobada.',
        url: reservation.thread?.id
          ? `/dashboard/host/messages?threadId=${reservation.thread.id}`
          : '/dashboard/host/messages',
        type: 'PAYMENT_STARTED'
      },
      prisma
    );

    return NextResponse.json({
      checkoutUrl: stripeSession.url,
      status: 'awaiting_payment',
      paymentExpiresAt:
        reservation.paymentExpiresAt?.toISOString() ||
        reservation.holdExpiresAt?.toISOString() ||
        null
    });
  } catch (error: any) {
    if (error?.message === 'CSRF token invalido') {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error?.message === 'No autorizado') {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    return NextResponse.json({ error: error.message || 'Error inesperado' }, { status: 500 });
  }
}
