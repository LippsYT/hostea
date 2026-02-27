import { addDays, differenceInCalendarDays, max as maxDate, min as minDate } from 'date-fns';
import { ReservationStatus } from '@prisma/client';
import { prisma } from '@/lib/db';
import { getSetting } from '@/lib/settings';
import {
  DynamicPriceBreakdown,
  DynamicPricingConfig,
  buildDynamicBreakdown,
  normalizeDynamicPricingConfig
} from '@/lib/dynamic-pricing';

export type PriceOverride = { startDate: Date; endDate: Date; price: number };

const keyForListing = (listingId: string) => `dynamicPricing:${listingId}`;
const dateKey = (value: Date) => value.toISOString().slice(0, 10);

const mergeOverridesByDay = (rows: PriceOverride[]) => {
  const map = new Map<string, number>();
  rows.forEach((row) => {
    for (
      let d = new Date(row.startDate);
      d <= row.endDate;
      d = addDays(d, 1)
    ) {
      map.set(dateKey(d), Number(row.price));
    }
  });
  return map;
};

const getListing = async (listingId: string) =>
  prisma.listing.findUnique({
    where: { id: listingId },
    select: { id: true, capacity: true, pricePerNight: true }
  });

export const getDynamicPricingConfigForListing = async (listingId: string) => {
  const listing = await getListing(listingId);
  if (!listing) return null;

  const setting = await getSetting<Record<string, unknown> | null>(keyForListing(listingId), null);
  const config = normalizeDynamicPricingConfig(setting, Number(listing.pricePerNight));
  return { listing, config };
};

export const saveDynamicPricingConfigForListing = async (
  listingId: string,
  value: DynamicPricingConfig
) => {
  const listing = await getListing(listingId);
  if (!listing) throw new Error('Listing no encontrado');

  const config = normalizeDynamicPricingConfig(value, Number(listing.pricePerNight));
  await prisma.settings.upsert({
    where: { key: keyForListing(listingId) },
    update: { value: config },
    create: { key: keyForListing(listingId), value: config }
  });
  return config;
};

export const computeOccupancyRateForListing = async ({
  listingId,
  from,
  to
}: {
  listingId: string;
  from: Date;
  to: Date;
}) => {
  const days = Math.max(1, differenceInCalendarDays(to, from));
  const now = new Date();
  const reservations = await prisma.reservation.findMany({
    where: {
      listingId,
      checkIn: { lt: to },
      checkOut: { gt: from },
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
    select: { checkIn: true, checkOut: true }
  });

  const calendarBlocks = await prisma.calendarBlock.findMany({
    where: {
      listingId,
      startDate: { lt: to },
      endDate: { gt: from },
      NOT: { reason: { startsWith: 'PRICE:' } }
    },
    select: { startDate: true, endDate: true }
  });
  const calendarHolds = await prisma.calendarHold.findMany({
    where: {
      listingId,
      startDate: { lt: to },
      endDate: { gt: from },
      expiresAt: { gt: now }
    },
    select: { startDate: true, endDate: true }
  });

  const occupiedDays = new Set<string>();
  const markRange = (start: Date, end: Date) => {
    const s = maxDate([start, from]);
    const e = minDate([end, to]);
    for (let d = new Date(s); d < e; d = addDays(d, 1)) {
      occupiedDays.add(dateKey(d));
    }
  };

  reservations.forEach((item) => markRange(item.checkIn, item.checkOut));
  calendarBlocks.forEach((item) => markRange(item.startDate, item.endDate));
  calendarHolds.forEach((item) => markRange(item.startDate, item.endDate));

  return Math.min(1, occupiedDays.size / days);
};

export const buildEffectivePriceOverrides = async ({
  listingId,
  checkIn,
  checkOut
}: {
  listingId: string;
  checkIn: Date;
  checkOut: Date;
}) => {
  const listingConfig = await getDynamicPricingConfigForListing(listingId);
  if (!listingConfig) {
    return {
      overrides: [] as PriceOverride[],
      dynamicConfig: null as DynamicPricingConfig | null,
      dynamicBreakdown: [] as DynamicPriceBreakdown[],
      occupancyRate: 0
    };
  }

  const manualPriceBlocks = await prisma.calendarBlock.findMany({
    where: {
      listingId,
      reason: { startsWith: 'PRICE:' },
      startDate: { lte: checkOut },
      endDate: { gte: checkIn }
    }
  });

  const manualOverrides = manualPriceBlocks
    .map((row) => {
      const price = Number((row.reason || '').replace('PRICE:', ''));
      if (!Number.isFinite(price)) return null;
      return { startDate: row.startDate, endDate: row.endDate, price };
    })
    .filter(Boolean) as PriceOverride[];

  const manualMap = mergeOverridesByDay(manualOverrides);
  const { config } = listingConfig;
  if (!config.enabled) {
    return {
      overrides: manualOverrides,
      dynamicConfig: config,
      dynamicBreakdown: [] as DynamicPriceBreakdown[],
      occupancyRate: 0
    };
  }

  const occupancyFrom = checkIn;
  const occupancyTo = addDays(checkIn, 60);
  const occupancyRate = await computeOccupancyRateForListing({
    listingId,
    from: occupancyFrom,
    to: occupancyTo
  });

  const dynamicBreakdown = buildDynamicBreakdown({
    checkIn,
    checkOut,
    occupancyRate,
    config
  });
  const dynamicMap = new Map<string, number>();
  dynamicBreakdown.forEach((row) => dynamicMap.set(row.date, row.finalPrice));

  // Manual PRICE: overrides always win over dynamic adjustments.
  const mergedDays = new Map<string, number>(dynamicMap);
  manualMap.forEach((price, day) => mergedDays.set(day, price));

  const overrides: PriceOverride[] = [];
  for (let d = new Date(checkIn); d < checkOut; d = addDays(d, 1)) {
    const key = dateKey(d);
    const price = mergedDays.get(key);
    if (price === undefined) continue;
    overrides.push({ startDate: new Date(d), endDate: new Date(d), price });
  }

  return {
    overrides,
    dynamicConfig: config,
    dynamicBreakdown,
    occupancyRate
  };
};
