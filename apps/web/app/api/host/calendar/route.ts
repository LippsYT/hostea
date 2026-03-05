import { NextResponse } from 'next/server';
import { ReservationStatus } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireSession } from '@/lib/permissions';
import { assertCsrf } from '@/lib/csrf';
import { z } from 'zod';
import { cleanupExpiredReservationHolds } from '@/lib/calendar-holds';

const schema = z.object({
  listingId: z.string(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  date: z.string().optional(),
  reason: z.string().optional(),
  price: z.coerce.number().optional(),
  availableUnits: z.coerce.number().int().min(0).optional()
});

const overlaps = (aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) =>
  aStart < bEnd && aEnd > bStart;

const startOfDayUtc = (value: Date) => {
  const date = new Date(value);
  date.setUTCHours(0, 0, 0, 0);
  return date;
};

const dateKey = (value: Date) => value.toISOString().slice(0, 10);
const isPriceBlock = (block: { reason?: string | null }) => (block.reason || '').startsWith('PRICE:');
const isAvailabilityOverrideBlock = (block: { reason?: string | null }) =>
  (block.reason || '').startsWith('AVAIL:');

const parseAvailabilityOverride = (reason?: string | null) => {
  if (!reason || !reason.startsWith('AVAIL:')) return null;
  const value = Number(reason.replace('AVAIL:', ''));
  if (!Number.isFinite(value)) return null;
  return Math.max(0, Math.trunc(value));
};

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
  const availabilityOverrideBlocks = blocks.filter((block) => isAvailabilityOverrideBlock(block));
  const availabilityOverridesByDate = new Map<string, number>();
  for (const block of availabilityOverrideBlocks) {
    const value = parseAvailabilityOverride(block.reason);
    if (value === null) continue;
    const dayStart = startOfDayUtc(block.startDate);
    const key = dateKey(dayStart);
    availabilityOverridesByDate.set(key, value);
  }

  const externalBlocks = blocks.filter((block) => (block.createdBy || '').startsWith('ICAL:'));
  const hardBlocks = blocks.filter(
    (block) =>
      !isPriceBlock(block) &&
      !isAvailabilityOverrideBlock(block) &&
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

    const key = dateKey(dayStart);
    const totalForDay = availabilityOverridesByDate.get(key) ?? inventoryQty;

    const hardBlocked = hardBlocks.some((block) =>
      overlaps(dayStart, dayEnd, block.startDate, block.endDate)
    );

    if (hardBlocked) {
      occupancyByDate[key] = { occupied: totalForDay, total: totalForDay };
      continue;
    }

    const reservationCount = reservations.filter((reservation) =>
      overlaps(dayStart, dayEnd, reservation.checkIn, reservation.checkOut)
    ).length;
    const holdCount = holds.filter((hold) => overlaps(dayStart, dayEnd, hold.startDate, hold.endDate)).length;
    const externalCount = externalBlocks.filter((block) =>
      overlaps(dayStart, dayEnd, block.startDate, block.endDate)
    ).length;

    const occupied = Math.min(totalForDay, reservationCount + holdCount + externalCount);
    occupancyByDate[key] = { occupied, total: totalForDay };
  }

  return NextResponse.json({
    blocks,
    reservations,
    holds,
    inventoryQty,
    occupancyByDate,
    availabilityOverrides: Object.fromEntries(availabilityOverridesByDate)
  });
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

  if (parsed.data.availableUnits !== undefined) {
    const rawDate = parsed.data.date || parsed.data.startDate;
    if (!rawDate) {
      return NextResponse.json({ error: 'Fecha requerida para disponibilidad diaria' }, { status: 400 });
    }

    const selectedDay = startOfDayUtc(new Date(rawDate));
    if (Number.isNaN(selectedDay.getTime())) {
      return NextResponse.json({ error: 'Fecha invalida' }, { status: 400 });
    }

    const nextDay = new Date(selectedDay);
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);
    const targetUnits = Math.max(0, Math.trunc(parsed.data.availableUnits));
    const maxUnits = Math.max(1, Number(listing.inventoryQty || 1));
    if (targetUnits > maxUnits) {
      return NextResponse.json(
        { error: `No puedes superar el inventario del anuncio (${maxUnits})` },
        { status: 400 }
      );
    }

    const now = new Date();
    const reservations = await prisma.reservation.findMany({
      where: {
        listingId: parsed.data.listingId,
        checkIn: { lt: nextDay },
        checkOut: { gt: selectedDay },
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
        status: true,
        paymentExpiresAt: true,
        holdExpiresAt: true
      }
    });

    const holds = await prisma.calendarHold.findMany({
      where: {
        listingId: parsed.data.listingId,
        startDate: { lt: nextDay },
        endDate: { gt: selectedDay },
        expiresAt: { gt: now }
      },
      select: { reservationId: true, startDate: true, endDate: true }
    });

    const externalBlocks = await prisma.calendarBlock.findMany({
      where: {
        listingId: parsed.data.listingId,
        createdBy: { startsWith: 'ICAL:' },
        startDate: { lt: nextDay },
        endDate: { gt: selectedDay }
      },
      select: { startDate: true, endDate: true }
    });

    const holdReservationIds = new Set(holds.map((hold) => hold.reservationId));
    const pendingReservationsWithoutHold = reservations.filter((reservation) => {
      const isPending =
        reservation.status === ReservationStatus.AWAITING_PAYMENT ||
        reservation.status === ReservationStatus.PENDING_PAYMENT;
      if (!isPending) return false;
      const expiresAt = reservation.paymentExpiresAt || reservation.holdExpiresAt;
      if (!expiresAt || expiresAt <= now) return false;
      return !holdReservationIds.has(reservation.id);
    });

    const activeReservationCount = reservations.filter(
      (reservation) =>
        (reservation.status === ReservationStatus.CONFIRMED ||
          reservation.status === ReservationStatus.CHECKED_IN ||
          reservation.status === ReservationStatus.COMPLETED) &&
        overlaps(selectedDay, nextDay, reservation.checkIn, reservation.checkOut)
    ).length;
    const activePendingCount = pendingReservationsWithoutHold.filter((reservation) =>
      overlaps(selectedDay, nextDay, reservation.checkIn, reservation.checkOut)
    ).length;
    const holdCount = holds.filter((hold) =>
      overlaps(selectedDay, nextDay, hold.startDate, hold.endDate)
    ).length;
    const externalCount = externalBlocks.filter((block) =>
      overlaps(selectedDay, nextDay, block.startDate, block.endDate)
    ).length;
    const occupiedCount = activeReservationCount + activePendingCount + holdCount + externalCount;

    if (targetUnits < occupiedCount) {
      return NextResponse.json(
        {
          error: `No puedes bajar a ${targetUnits}. Ya hay ${occupiedCount} habitaciones ocupadas ese dia.`
        },
        { status: 400 }
      );
    }

    await prisma.calendarBlock.deleteMany({
      where: {
        listingId: parsed.data.listingId,
        reason: { startsWith: 'AVAIL:' },
        startDate: { lt: nextDay },
        endDate: { gt: selectedDay }
      }
    });

    if (targetUnits === maxUnits) {
      return NextResponse.json({ ok: true, override: null });
    }

    const override = await prisma.calendarBlock.create({
      data: {
        listingId: parsed.data.listingId,
        startDate: selectedDay,
        endDate: nextDay,
        reason: `AVAIL:${targetUnits}`,
        createdBy: (session.user as any).id
      }
    });

    return NextResponse.json({ ok: true, override });
  }

  if (!parsed.data.startDate || !parsed.data.endDate) {
    return NextResponse.json({ error: 'Rango de fechas requerido' }, { status: 400 });
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
