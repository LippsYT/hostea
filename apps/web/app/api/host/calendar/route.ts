import { NextResponse } from 'next/server';
import { ReservationStatus } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireSession } from '@/lib/permissions';
import { assertCsrf } from '@/lib/csrf';
import { z } from 'zod';
import { cleanupExpiredReservationHolds } from '@/lib/calendar-holds';

const schema = z.object({
  listingId: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  reason: z.string().optional(),
  price: z.coerce.number().optional()
});

const overlaps = (aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) =>
  aStart < bEnd && aEnd > bStart;

const startOfDayUtc = (value: Date) => {
  const date = new Date(value);
  date.setUTCHours(0, 0, 0, 0);
  return date;
};

const dateKey = (value: Date) => value.toISOString().slice(0, 10);

export async function GET(req: Request) {
  const session = await requireSession();
  const { searchParams } = new URL(req.url);
  const listingId = searchParams.get('listingId');
  if (!listingId) return NextResponse.json({ error: 'listingId requerido' }, { status: 400 });

  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    select: { id: true, hostId: true, inventoryQty: true }
  });
  if (!listing || listing.hostId !== (session.user as any).id) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  await cleanupExpiredReservationHolds(prisma);

  const now = new Date();
  const blocks = await prisma.calendarBlock.findMany({
    where: { listingId },
    orderBy: { startDate: 'asc' }
  });
  const reservations = await prisma.reservation.findMany({
    where: {
      listingId,
      OR: [
        { status: ReservationStatus.CONFIRMED },
        { status: ReservationStatus.CHECKED_IN },
        { status: ReservationStatus.COMPLETED },
        {
          status: ReservationStatus.AWAITING_PAYMENT,
          OR: [{ paymentExpiresAt: { gt: now } }, { holdExpiresAt: { gt: now } }]
        },
        {
          status: ReservationStatus.PENDING_PAYMENT,
          OR: [{ paymentExpiresAt: { gt: now } }, { holdExpiresAt: { gt: now } }]
        }
      ]
    },
    select: {
      id: true,
      checkIn: true,
      checkOut: true,
      status: true
    },
    orderBy: { checkIn: 'asc' }
  });

  const holds = await prisma.calendarHold.findMany({
    where: {
      listingId,
      expiresAt: { gt: now }
    },
    select: {
      id: true,
      reservationId: true,
      startDate: true,
      endDate: true,
      expiresAt: true
    },
    orderBy: { startDate: 'asc' }
  });

  const inventoryQty = Math.max(1, Number(listing.inventoryQty || 1));
  const externalBlocks = blocks.filter((block) => (block.createdBy || '').startsWith('ICAL:'));
  const hardBlocks = blocks.filter(
    (block) =>
      !(block.reason || '').startsWith('PRICE:') &&
      !(block.createdBy || '').startsWith('ICAL:') &&
      !(block.createdBy || '').startsWith('reservation-hold:') &&
      !(block.createdBy || '').startsWith('offer:') &&
      !(block.reason || '').startsWith('Reserva confirmada') &&
      !(block.reason || '').startsWith('Oferta pendiente pago')
  );

  const occupancyByDate: Record<string, { occupied: number; total: number }> = {};
  const rangeStart = startOfDayUtc(new Date(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const rangeEnd = new Date(rangeStart);
  rangeEnd.setUTCDate(rangeEnd.getUTCDate() + 120);

  for (let cursor = new Date(rangeStart); cursor < rangeEnd; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    const dayStart = new Date(cursor);
    const dayEnd = new Date(cursor);
    dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

    const hardBlocked = hardBlocks.some((block) =>
      overlaps(dayStart, dayEnd, block.startDate, block.endDate)
    );

    if (hardBlocked) {
      occupancyByDate[dateKey(dayStart)] = { occupied: inventoryQty, total: inventoryQty };
      continue;
    }

    const reservationCount = reservations.filter((reservation) =>
      overlaps(dayStart, dayEnd, reservation.checkIn, reservation.checkOut)
    ).length;
    const holdCount = holds.filter((hold) => overlaps(dayStart, dayEnd, hold.startDate, hold.endDate)).length;
    const externalCount = externalBlocks.filter((block) =>
      overlaps(dayStart, dayEnd, block.startDate, block.endDate)
    ).length;

    const occupied = Math.min(inventoryQty, reservationCount + holdCount + externalCount);
    occupancyByDate[dateKey(dayStart)] = { occupied, total: inventoryQty };
  }

  return NextResponse.json({ blocks, reservations, holds, inventoryQty, occupancyByDate });
}

export async function POST(req: Request) {
  assertCsrf(req);
  const session = await requireSession();
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Datos invalidos' }, { status: 400 });

  const listing = await prisma.listing.findUnique({ where: { id: parsed.data.listingId } });
  if (!listing || listing.hostId !== (session.user as any).id) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const block = await prisma.calendarBlock.create({
    data: {
      listingId: parsed.data.listingId,
      startDate: new Date(parsed.data.startDate),
      endDate: new Date(parsed.data.endDate),
      reason: parsed.data.price ? `PRICE:${parsed.data.price}` : parsed.data.reason,
      createdBy: (session.user as any).id
    }
  });
  return NextResponse.json({ block });
}
