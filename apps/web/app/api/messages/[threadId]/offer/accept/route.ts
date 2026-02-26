import { NextResponse } from 'next/server';
import { assertCsrf } from '@/lib/csrf';
import { prisma } from '@/lib/db';
import { requireSession } from '@/lib/permissions';
import { rateLimit } from '@/lib/rate-limit';
import { stripe } from '@/lib/stripe';
import { PaymentStatus, ReservationStatus } from '@prisma/client';

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

    const thread = await prisma.messageThread.findFirst({
      where: {
        id: params.threadId,
        participants: { some: { userId } }
      },
      include: {
        reservation: {
          include: {
            listing: true,
            payment: true
          }
        }
      }
    });

    if (!thread) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }
    if (!thread.offerTotal) {
      return NextResponse.json({ error: 'No hay oferta activa en este chat' }, { status: 400 });
    }
    if (thread.offerExpiresAt && thread.offerExpiresAt.getTime() < Date.now()) {
      return NextResponse.json({ error: 'La oferta especial vencio' }, { status: 400 });
    }
    if (!thread.reservation) {
      return NextResponse.json(
        { error: 'Esta oferta no tiene reserva asociada. Solicita al host una preaprobacion con fechas.' },
        { status: 400 }
      );
    }

    const reservation = thread.reservation;
    if (reservation.userId !== userId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }
    if (reservation.status !== ReservationStatus.PENDING_PAYMENT) {
      return NextResponse.json({ error: 'La reserva ya no admite pago de oferta' }, { status: 400 });
    }

    const offerAmount = Number(thread.offerTotal);
    if (!Number.isFinite(offerAmount) || offerAmount <= 0) {
      return NextResponse.json({ error: 'Monto de oferta invalido' }, { status: 400 });
    }

    const stripeSession = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      success_url: `${process.env.APP_URL}/success?reservationId=${reservation.id}`,
      cancel_url: `${process.env.APP_URL}/cancel?reservationId=${reservation.id}`,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: { name: `${reservation.listing.title} (Oferta especial)` },
            unit_amount: Math.round(offerAmount * 100)
          },
          quantity: 1
        }
      ],
      metadata: { reservationId: reservation.id, threadId: thread.id, kind: 'special_offer' }
    });

    if (!stripeSession.url) {
      return NextResponse.json({ error: 'No se pudo iniciar checkout' }, { status: 500 });
    }

    await prisma.reservation.update({
      where: { id: reservation.id },
      data: {
        total: offerAmount,
        currency: 'USD',
        holdExpiresAt: new Date(Date.now() + 15 * 60 * 1000)
      }
    });

    await prisma.payment.upsert({
      where: { reservationId: reservation.id },
      create: {
        reservationId: reservation.id,
        userId,
        stripeSessionId: stripeSession.id,
        amount: offerAmount,
        currency: 'USD',
        status: PaymentStatus.REQUIRES_ACTION
      },
      update: {
        stripeSessionId: stripeSession.id,
        amount: offerAmount,
        currency: 'USD',
        status: PaymentStatus.REQUIRES_ACTION
      }
    });

    await prisma.message.create({
      data: {
        threadId: thread.id,
        senderId: userId,
        body: `Oferta aceptada por el cliente. Nuevo total: USD ${offerAmount.toFixed(2)}.`
      }
    });

    return NextResponse.json({ checkoutUrl: stripeSession.url });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Error' }, { status: 500 });
  }
}
