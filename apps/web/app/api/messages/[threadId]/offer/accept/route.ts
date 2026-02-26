import { NextResponse } from 'next/server';
import { z } from 'zod';
import { assertCsrf } from '@/lib/csrf';
import { prisma } from '@/lib/db';
import { requireSession } from '@/lib/permissions';
import { rateLimit } from '@/lib/rate-limit';
import { stripe } from '@/lib/stripe';
import { checkListingAvailability } from '@/lib/listing-availability';

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

    const availability = await checkListingAvailability({
      listingId: offer.listingId,
      checkIn: offer.checkIn,
      checkOut: offer.checkOut,
      guests: offer.guestsCount
    });
    if (!availability.available) {
      return NextResponse.json(
        { error: availability.message || 'Fechas no disponibles para esta oferta' },
        { status: 409 }
      );
    }

    const holdOwner = `offer:${offer.id}`;
    await prisma.calendarBlock.deleteMany({
      where: { listingId: offer.listingId, createdBy: holdOwner }
    });
    await prisma.calendarBlock.create({
      data: {
        listingId: offer.listingId,
        startDate: offer.checkIn,
        endDate: offer.checkOut,
        reason: 'Oferta pendiente pago',
        createdBy: holdOwner
      }
    });

    const stripeSession = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      success_url: `${process.env.APP_URL}/success?offerId=${offer.id}`,
      cancel_url: `${process.env.APP_URL}/cancel?offerId=${offer.id}`,
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
        guestId: userId
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
        paymentSessionId: stripeSession.id
      }
    });

    await prisma.message.create({
      data: {
        threadId: thread.id,
        senderId: userId,
        body: `El cliente inicio checkout para la oferta de USD ${offerAmount.toFixed(2)}.`
      }
    });

    return NextResponse.json({ checkoutUrl: stripeSession.url });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Error' }, { status: 500 });
  }
}
