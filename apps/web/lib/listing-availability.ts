import { ReservationStatus } from '@prisma/client';
import { prisma } from '@/lib/db';
import {
  getCloudbedsAvailability,
  isCloudbedsEnabled,
  isCloudbedsStrict
} from '@/lib/cloudbeds';
import { cleanupExpiredReservationHolds } from '@/lib/calendar-holds';

export type ListingAvailabilityResult = {
  available: boolean;
  source: 'cloudbeds' | 'local';
  message?: string;
  roomTypes?: Array<{ roomTypeId: string; name: string; availableUnits: number }>;
};

type AvailabilityInput = {
  listingId: string;
  checkIn: Date;
  checkOut: Date;
  guests: number;
  excludeReservationId?: string;
};

const overlaps = (aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) =>
  aStart < bEnd && aEnd > bStart;

const startOfDayUtc = (value: Date) => {
  const date = new Date(value);
  date.setUTCHours(0, 0, 0, 0);
  return date;
};

const buildNightWindows = (checkIn: Date, checkOut: Date) => {
  const nights: Array<{ start: Date; end: Date }> = [];
  const cursor = startOfDayUtc(checkIn);
  const limit = startOfDayUtc(checkOut);
  while (cursor < limit) {
    const start = new Date(cursor);
    const end = new Date(cursor);
    end.setUTCDate(end.getUTCDate() + 1);
    nights.push({ start, end });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return nights;
};

const localAvailability = async (
  args: AvailabilityInput,
  inventoryQty: number
): Promise<ListingAvailabilityResult> => {
  const cloudbeds = isCloudbedsEnabled();
  const now = new Date();

  await cleanupExpiredReservationHolds(prisma);

  const reservations = await prisma.reservation.findMany({
    where: {
      ...(args.excludeReservationId ? { id: { not: args.excludeReservationId } } : {}),
      listingId: args.listingId,
      checkIn: { lt: args.checkOut },
      checkOut: { gt: args.checkIn },
      status: {
        in: [
          ReservationStatus.CONFIRMED,
          ReservationStatus.CHECKED_IN,
          ReservationStatus.COMPLETED,
          ReservationStatus.AWAITING_PAYMENT,
          ReservationStatus.PENDING_PAYMENT
        ]
      }
    },
    select: {
      id: true,
      status: true,
      checkIn: true,
      checkOut: true,
      paymentExpiresAt: true,
      holdExpiresAt: true
    }
  });

  const activeHolds = await prisma.calendarHold.findMany({
    where: {
      listingId: args.listingId,
      ...(args.excludeReservationId ? { reservationId: { not: args.excludeReservationId } } : {}),
      expiresAt: { gt: now },
      startDate: { lt: args.checkOut },
      endDate: { gt: args.checkIn }
    },
    select: {
      reservationId: true,
      startDate: true,
      endDate: true
    }
  });

  const hardBlocks = await prisma.calendarBlock.findMany({
    where: {
      listingId: args.listingId,
      startDate: { lt: args.checkOut },
      endDate: { gt: args.checkIn },
      NOT: [
        { reason: { startsWith: 'PRICE:' } },
        { reason: { startsWith: 'AVAIL:' } },
        { createdBy: { startsWith: 'ICAL:' } },
        { createdBy: { startsWith: 'reservation-hold:' } },
        { reason: { startsWith: 'Reserva confirmada' } },
        { reason: { startsWith: 'Oferta pendiente pago' } }
      ]
    },
    select: { startDate: true, endDate: true }
  });

  const externalBlocks = await prisma.calendarBlock.findMany({
    where: {
      listingId: args.listingId,
      createdBy: { startsWith: 'ICAL:' },
      startDate: { lt: args.checkOut },
      endDate: { gt: args.checkIn }
    },
    select: { startDate: true, endDate: true }
  });

  const availabilityOverrideBlocks = await prisma.calendarBlock.findMany({
    where: {
      listingId: args.listingId,
      reason: { startsWith: 'AVAIL:' },
      startDate: { lt: args.checkOut },
      endDate: { gt: args.checkIn }
    },
    select: { startDate: true, endDate: true, reason: true }
  });

  const availabilityOverrideByDate = new Map<string, number>();
  availabilityOverrideBlocks.forEach((block) => {
    const value = Number((block.reason || '').replace('AVAIL:', ''));
    if (!Number.isFinite(value)) return;
    const key = block.startDate.toISOString().slice(0, 10);
    availabilityOverrideByDate.set(key, Math.max(0, Math.trunc(value)));
  });

  const holdReservationIds = new Set(activeHolds.map((hold) => hold.reservationId));
  const isConfirmedStatus = (status: ReservationStatus) =>
    status === ReservationStatus.CONFIRMED ||
    status === ReservationStatus.CHECKED_IN ||
    status === ReservationStatus.COMPLETED;

  const pendingReservationsWithoutHold = reservations.filter((reservation) => {
    const isPendingStatus =
      reservation.status === ReservationStatus.AWAITING_PAYMENT ||
      reservation.status === ReservationStatus.PENDING_PAYMENT;
    if (!isPendingStatus) {
      return false;
    }
    const expiresAt = reservation.paymentExpiresAt || reservation.holdExpiresAt;
    if (!expiresAt || expiresAt <= now) return false;
    return !holdReservationIds.has(reservation.id);
  });

  const nights = buildNightWindows(args.checkIn, args.checkOut);

  for (const night of nights) {
    const nightKey = night.start.toISOString().slice(0, 10);
    const totalForDay = availabilityOverrideByDate.get(nightKey) ?? inventoryQty;
    const isHardBlocked = hardBlocks.some((block) =>
      overlaps(night.start, night.end, block.startDate, block.endDate)
    );

    if (isHardBlocked) {
      return {
        available: false,
        source: 'local',
        message: 'Fechas bloqueadas en calendario'
      };
    }

    const confirmedCount = reservations.filter(
      (reservation) =>
        isConfirmedStatus(reservation.status) &&
        overlaps(night.start, night.end, reservation.checkIn, reservation.checkOut)
    ).length;

    const pendingCount = pendingReservationsWithoutHold.filter((reservation) =>
      overlaps(night.start, night.end, reservation.checkIn, reservation.checkOut)
    ).length;

    const holdCount = activeHolds.filter((hold) =>
      overlaps(night.start, night.end, hold.startDate, hold.endDate)
    ).length;

    const externalCount = externalBlocks.filter((block) =>
      overlaps(night.start, night.end, block.startDate, block.endDate)
    ).length;

    const availableUnits = totalForDay - confirmedCount - pendingCount - holdCount - externalCount;
    if (availableUnits <= 0) {
      return { available: false, source: 'local', message: 'Fechas no disponibles' };
    }
  }

  if (!cloudbeds) {
    return { available: true, source: 'local' };
  }

  return { available: true, source: 'local' };
};

export const checkListingAvailability = async (
  args: AvailabilityInput
): Promise<ListingAvailabilityResult> => {
  const listing = await prisma.listing.findUnique({
    where: { id: args.listingId },
    select: { id: true, status: true, capacity: true, inventoryQty: true }
  });
  if (!listing || listing.status !== 'ACTIVE') {
    return { available: false, source: 'local', message: 'Listing inactivo o inexistente' };
  }
  if (args.guests > listing.capacity) {
    return { available: false, source: 'local', message: 'Supera capacidad permitida' };
  }

  const inventoryQty = Math.max(1, Number(listing.inventoryQty || 1));
  const local = await localAvailability(args, inventoryQty);
  if (!local.available) {
    return local;
  }

  if (!isCloudbedsEnabled()) {
    return local;
  }

  try {
    const cloudbeds = await getCloudbedsAvailability({
      listingId: args.listingId,
      checkIn: args.checkIn,
      checkOut: args.checkOut
    });
    if (!cloudbeds.available) {
      return {
        available: false,
        source: 'cloudbeds',
        roomTypes: cloudbeds.roomTypes,
        message: 'Sin disponibilidad en Cloudbeds'
      };
    }
    return {
      available: true,
      source: 'cloudbeds',
      roomTypes: cloudbeds.roomTypes
    };
  } catch (error: any) {
    if (isCloudbedsStrict()) {
      return {
        available: false,
        source: 'cloudbeds',
        message: `Cloudbeds no disponible: ${error?.message || 'error de integracion'}`
      };
    }
    return {
      ...local,
      message: 'Cloudbeds no disponible, se uso disponibilidad local'
    };
  }
};
