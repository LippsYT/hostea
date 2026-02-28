import { NextResponse } from 'next/server';
import { z } from 'zod';
import { assertCsrf } from '@/lib/csrf';
import { prisma } from '@/lib/db';
import { requireSession } from '@/lib/permissions';
import { rateLimit } from '@/lib/rate-limit';
import { stripe } from '@/lib/stripe';
import { checkListingAvailability } from '@/lib/listing-availability';
import { sendPushToHost } from '@/lib/push-notifications';
import { PaymentStatus, ReservationStatus } from '@prisma/client';
import { buildPaymentExpiresAt } from '@/lib/reservation-request-flow';
import { createOrRefreshReservationHold } from '@/lib/calendar-holds';

const schema = z.object({
  offerId: z.string().optional()
});

export async function POST(
  req: Request,
  { params }: { params: { threadId: string } }
) {
  try {
    assertCsrf(req);
    const session = await requireSession();
    const userId = (session.user as any).id as string;
    const ok = await rateLimit(`offer:accept:${userId}`, 10, 60);
    if (!ok) {
      return NextResponse.json({ error: 'Rate limit' }, { status: 429 });
    }

    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Datos invalidos' }, { status: 400 });
    }

    const thread = await prisma.messageThread.findFirst({
      where: {
        id: params.threadId,
        participants: { some: { userId } }
      }
    });
    if (!thread) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    await prisma.offer.updateMany({
      where: {
        threadId: thread.id,
        guestId: userId,
        status: 'PENDING',
        expiresAt: { lt: new Date() }
      },
      data: { status: 'EXPIRED' }
    });

    const offer = await prisma.offer.findFirst({
      where: {
        threadId: thread.id,
        id: parsed.data.offerId,
        guestId: userId,
        status: { in: ['PENDING', 'ACCEPTED'] },
        expiresAt: { gt: new Date() }
      },
      include: { listing: true }
    });

    if (!offer) {
      return NextResponse.json({ error: 'No hay oferta activa en este chat' }, { status: 400 });
    }

    const offerAmount = Number(offer.clientTotal);
    if (!Number.isFinite(offerAmount) || offerAmount <= 0) {
      return NextResponse.json({ error: 'Monto de oferta invalido' }, { status: 400 });
    }

    const existingReservation = offer.reservationId
      ? await prisma.reservation.findUnique({
          where: { id: offer.reservationId },
          include: { payment: true, thread: true }
        })
      : null;

    const availability = await checkListingAvailability({
      listingId: offer.listingId,
      checkIn: offer.checkIn,
      checkOut: offer.checkOut,
      guests: offer.guestsCount,
      excludeReservationId: existingReservation?.id
    });
    if (!availability.available) {
      return NextResponse.json(
        { error: availability.message || 'Fechas no disponibles para esta oferta' },
        { status: 409 }
      );
    }

    const paymentExpiresAt = buildPaymentExpiresAt();
    const reservation =
      existingReservation ||
      (await prisma.reservation.create({
        data: {
          listingId: offer.listingId,
          userId: offer.guestId,
          checkIn: offer.checkIn,
          checkOut: offer.checkOut,
          guestsCount: offer.guestsCount,
          total: offer.clientTotal,
          currency: offer.currency || 'USD',
          status: ReservationStatus.AWAITING_PAYMENT,
          paymentExpiresAt,
          holdExpiresAt: paymentExpiresAt
        }
      }));

    await prisma.reservation.update({
      where: { id: reservation.id },
      data: {
        status: ReservationStatus.AWAITING_PAYMENT,
        paymentExpiresAt,
        holdExpiresAt: paymentExpiresAt
      }
    });

    await createOrRefreshReservationHold({
      listingId: offer.listingId,
      reservationId: reservation.id,
      checkIn: offer.checkIn,
      checkOut: offer.checkOut,
      expiresAt: paymentExpiresAt
    });

    const stripeSession = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      success_url: `${process.env.APP_URL}/success?offerId=${offer.id}&reservationId=${reservation.id}`,
      cancel_url: `${process.env.APP_URL}/cancel?offerId=${offer.id}&reservationId=${reservation.id}`,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: { name: `${offer.listing.title} (Oferta especial)` },
            unit_amount: Math.round(offerAmount * 100)
          },
          quantity: 1
        }
      ],
      metadata: {
        kind: 'special_offer',
        offerId: offer.id,
        threadId: thread.id,
        listingId: offer.listingId,
        guestId: userId,
        reservationId: reservation.id
      }
    });

    if (!stripeSession.url) {
      return NextResponse.json({ error: 'No se pudo iniciar checkout' }, { status: 500 });
    }

    await prisma.offer.update({
      where: { id: offer.id },
      data: {
        status: 'ACCEPTED',
        acceptedAt: new Date(),
        paymentSessionId: stripeSession.id,
        reservationId: reservation.id
      }
    });

    await prisma.messageThread.update({
      where: { id: thread.id },
      data: {
        status: 'PREAPPROVED',
        reservationId: reservation.id,
        offerTotal: offer.clientTotal,
        offerCurrency: offer.currency || 'USD',
        offerExpiresAt: paymentExpiresAt
      }
    });

    if (existingReservation?.payment) {
      await prisma.payment.update({
        where: { id: existingReservation.payment.id },
        data: {
          stripeSessionId: stripeSession.id,
          amount: offer.clientTotal,
          currency: offer.currency || 'USD',
          status: PaymentStatus.REQUIRES_ACTION
        }
      });
    } else {
      await prisma.payment.create({
        data: {
          reservationId: reservation.id,
          userId: offer.guestId,
          stripeSessionId: stripeSession.id,
          amount: offer.clientTotal,
          currency: offer.currency || 'USD',
          status: PaymentStatus.REQUIRES_ACTION
        }
      });
    }

    await prisma.message.create({
      data: {
        threadId: thread.id,
        senderId: userId,
        body: `Oferta aceptada. Checkout iniciado por USD ${offerAmount.toFixed(
          2
        )}. Completa el pago en los proximos 30 minutos.`
      }
    });

    await sendPushToHost(offer.hostId, {
      title: 'Oferta aceptada',
      body: `El cliente inicio el pago de la oferta en ${offer.listing.title}.`,
      url: `/dashboard/host/messages?threadId=${thread.id}`,
      type: 'OFFER_ACCEPTED'
    });

    return NextResponse.json({
      checkoutUrl: stripeSession.url,
      reservationId: reservation.id,
      paymentExpiresAt: paymentExpiresAt.toISOString()
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Error' }, { status: 500 });
  }
}
