import { ReservationStatus } from '@prisma/client';
import { prisma } from '@/lib/db';
import {
  getCloudbedsAvailability,
  isCloudbedsEnabled,
  isCloudbedsStrict
} from '@/lib/cloudbeds';

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

const localAvailability = async (args: AvailabilityInput): Promise<ListingAvailabilityResult> => {
  const cloudbeds = isCloudbedsEnabled();
  const now = new Date();
  const overlapping = await prisma.reservation.findFirst({
    where: {
      ...(args.excludeReservationId ? { id: { not: args.excludeReservationId } } : {}),
      listingId: args.listingId,
      checkIn: { lt: args.checkOut },
      checkOut: { gt: args.checkIn },
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
    }
  });

  if (overlapping) {
    return { available: false, source: 'local', message: 'Fechas no disponibles' };
  }

  const hasBlockingCalendarEvent = await prisma.calendarBlock.findFirst({
    where: {
      listingId: args.listingId,
      startDate: { lt: args.checkOut },
      endDate: { gt: args.checkIn },
      NOT: [
        { reason: { startsWith: 'PRICE:' } },
        ...(cloudbeds ? [{ createdBy: { startsWith: 'ICAL:' as const } }] : [])
      ]
    }
  });

  if (hasBlockingCalendarEvent) {
    return {
      available: false,
      source: 'local',
      message: 'Fechas bloqueadas en calendario'
    };
  }

  return { available: true, source: 'local' };
};

export const checkListingAvailability = async (
  args: AvailabilityInput
): Promise<ListingAvailabilityResult> => {
  const listing = await prisma.listing.findUnique({
    where: { id: args.listingId },
    select: { id: true, status: true, capacity: true }
  });
  if (!listing || listing.status !== 'ACTIVE') {
    return { available: false, source: 'local', message: 'Listing inactivo o inexistente' };
  }
  if (args.guests > listing.capacity) {
    return { available: false, source: 'local', message: 'Supera capacidad permitida' };
  }

  const local = await localAvailability(args);
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
