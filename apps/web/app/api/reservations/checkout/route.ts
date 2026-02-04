import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { assertCsrf } from '@/lib/csrf';
import { rateLimit } from '@/lib/rate-limit';
import { requireSession } from '@/lib/permissions';
import { calculatePrice } from '@/lib/pricing';
import { stripe } from '@/lib/stripe';
import { ReservationStatus, PaymentStatus } from '@prisma/client';

const schema = z.object({
  listingId: z.string(),
  checkIn: z.string(),
  checkOut: z.string(),
  guests: z.coerce.number().optional(),
  guestsBreakdown: z
    .object({
      adults: z.coerce.number().min(1),
      children: z.coerce.number().min(0),
      infants: z.coerce.number().min(0),
      pets: z.coerce.number().min(0)
    })
    .optional()
});

export async function POST(req: Request) {
  try {
    assertCsrf(req);
    const session = await requireSession();
    const ok = await rateLimit(`checkout:${(session.user as any).id}`, 5, 60);
    if (!ok) return NextResponse.json({ error: 'Rate limit' }, { status: 429 });

    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Datos invalidos' }, { status: 400 });
    }
    const { listingId, checkIn, checkOut, guests, guestsBreakdown } = parsed.data;
    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);
    if (Number.isNaN(checkInDate.getTime()) || Number.isNaN(checkOutDate.getTime()) || checkOutDate <= checkInDate) {
      return NextResponse.json({ error: 'Fechas invalidas' }, { status: 400 });
    }
    const listing = await prisma.listing.findUnique({ where: { id: listingId } });
    if (!listing) return NextResponse.json({ error: 'Listing no encontrado' }, { status: 404 });
    if (listing.status !== 'ACTIVE') {
      return NextResponse.json({ error: 'Listing inactivo' }, { status: 400 });
    }
    const guestsCount = guestsBreakdown
      ? guestsBreakdown.adults + guestsBreakdown.children + guestsBreakdown.infants
      : Number(guests || 1);
    if (guestsCount > listing.capacity) {
      return NextResponse.json({ error: 'Supera la capacidad del listing' }, { status: 400 });
    }

    const now = new Date();
    const overlapping = await prisma.reservation.findFirst({
      where: {
        listingId,
        AND: [
          { checkIn: { lt: checkOutDate } },
          { checkOut: { gt: checkInDate } },
          {
            OR: [
              { status: ReservationStatus.CONFIRMED },
              {
                status: ReservationStatus.PENDING_PAYMENT,
                holdExpiresAt: { gt: now }
              }
            ]
          }
        ]
      }
    });
    if (overlapping) {
      return NextResponse.json({ error: 'Fechas no disponibles' }, { status: 409 });
    }

    const priceBlocks = await prisma.calendarBlock.findMany({
      where: {
        listingId,
        reason: { startsWith: 'PRICE:' },
        startDate: { lte: checkOutDate },
        endDate: { gte: checkInDate }
      }
    });
    const overrides = priceBlocks
      .map((b) => {
        const raw = (b.reason || '').replace('PRICE:', '');
        const value = Number(raw);
        if (!Number.isFinite(value)) return null;
        return { startDate: b.startDate, endDate: b.endDate, price: value };
      })
      .filter(Boolean) as { startDate: Date; endDate: Date; price: number }[];

    const pricing = calculatePrice({
      checkIn: checkInDate,
      checkOut: checkOutDate,
      pricePerNight: Number(listing.pricePerNight),
      cleaningFee: Number(listing.cleaningFee),
      serviceFee: Number(listing.serviceFee),
      taxRate: Number(listing.taxRate),
      overrides
    });

    const reservation = await prisma.reservation.create({
      data: {
        listingId,
        userId: (session.user as any).id,
        checkIn: checkInDate,
        checkOut: checkOutDate,
        guestsCount: guestsCount,
        total: pricing.total,
        currency: 'USD',
        status: ReservationStatus.PENDING_PAYMENT,
        holdExpiresAt: new Date(Date.now() + 30 * 60 * 1000)
      }
    });

    const stripeSession = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      success_url: `${process.env.APP_URL}/success?reservationId=${reservation.id}`,
      cancel_url: `${process.env.APP_URL}/cancel?reservationId=${reservation.id}`,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: { name: listing.title },
            unit_amount: Math.round(pricing.total * 100)
          },
          quantity: 1
        }
      ],
      metadata: { reservationId: reservation.id }
    });

    if (!stripeSession.url) {
      return NextResponse.json({ error: 'No se pudo crear checkout' }, { status: 500 });
    }

    await prisma.payment.create({
      data: {
        reservationId: reservation.id,
        userId: (session.user as any).id,
        stripeSessionId: stripeSession.id,
        amount: pricing.total,
        currency: 'USD',
        status: PaymentStatus.REQUIRES_ACTION
      }
    });

    return NextResponse.json({ checkoutUrl: stripeSession.url });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Error inesperado' }, { status: 500 });
  }
}
