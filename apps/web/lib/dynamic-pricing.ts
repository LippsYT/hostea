import { addDays, differenceInCalendarDays, getDay } from 'date-fns';

export type DynamicPricingConfig = {
  enabled: boolean;
  basePrice: number;
  minPrice: number;
  maxPrice: number;
};

export type DynamicPriceBreakdown = {
  date: string;
  basePrice: number;
  occupancyRate: number;
  occupancyAdjustmentPct: number;
  leadTimeDays: number;
  leadTimeAdjustmentPct: number;
  dayOfWeekAdjustmentPct: number;
  finalPrice: number;
};

const round2 = (value: number) => Math.round(value * 100) / 100;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const toNumber = (value: unknown, fallback: number) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

export const normalizeDynamicPricingConfig = (
  value: unknown,
  fallbackBasePrice: number
): DynamicPricingConfig => {
  const raw = (value || {}) as Partial<DynamicPricingConfig>;
  const basePrice = Math.max(1, toNumber(raw.basePrice, fallbackBasePrice));
  const minPrice = Math.max(1, toNumber(raw.minPrice, Math.max(1, basePrice * 0.7)));
  const maxPrice = Math.max(minPrice, toNumber(raw.maxPrice, Math.max(basePrice, basePrice * 1.6)));
  return {
    enabled: Boolean(raw.enabled),
    basePrice: round2(clamp(basePrice, minPrice, maxPrice)),
    minPrice: round2(minPrice),
    maxPrice: round2(maxPrice)
  };
};

export const occupancyAdjustmentPct = (occupancyRate: number) => {
  const rate = clamp(occupancyRate, 0, 1);
  if (rate <= 0.2) return -0.12;
  if (rate <= 0.4) return -0.06;
  if (rate <= 0.65) return 0;
  if (rate <= 0.85) return 0.1;
  return 0.18;
};

export const leadTimeAdjustmentPct = (leadTimeDays: number) => {
  if (leadTimeDays <= 2) return 0.2;
  if (leadTimeDays <= 6) return 0.12;
  if (leadTimeDays <= 14) return 0.06;
  if (leadTimeDays >= 90) return -0.12;
  if (leadTimeDays >= 45) return -0.07;
  return 0;
};

export const dayOfWeekAdjustmentPct = (date: Date) => {
  const day = getDay(date);
  if (day === 5 || day === 6) return 0.12; // viernes/sabado
  if (day === 0) return 0.04; // domingo
  return 0;
};

export const calculateDynamicNightPrice = ({
  date,
  now,
  occupancyRate,
  config
}: {
  date: Date;
  now: Date;
  occupancyRate: number;
  config: DynamicPricingConfig;
}): DynamicPriceBreakdown => {
  const basePrice = config.basePrice;
  const leadTimeDays = Math.max(0, differenceInCalendarDays(date, now));
  const occupancyPct = occupancyAdjustmentPct(occupancyRate);
  const leadPct = leadTimeAdjustmentPct(leadTimeDays);
  const dowPct = dayOfWeekAdjustmentPct(date);
  const raw = basePrice * (1 + occupancyPct + leadPct + dowPct);
  const finalPrice = round2(clamp(raw, config.minPrice, config.maxPrice));

  return {
    date: date.toISOString().slice(0, 10),
    basePrice: round2(basePrice),
    occupancyRate: round2(occupancyRate * 100) / 100,
    occupancyAdjustmentPct: round2(occupancyPct * 100) / 100,
    leadTimeDays,
    leadTimeAdjustmentPct: round2(leadPct * 100) / 100,
    dayOfWeekAdjustmentPct: round2(dowPct * 100) / 100,
    finalPrice
  };
};

export const buildDynamicBreakdown = ({
  checkIn,
  checkOut,
  occupancyRate,
  config,
  now = new Date()
}: {
  checkIn: Date;
  checkOut: Date;
  occupancyRate: number;
  config: DynamicPricingConfig;
  now?: Date;
}) => {
  const nights = Math.max(1, differenceInCalendarDays(checkOut, checkIn));
  const rows: DynamicPriceBreakdown[] = [];
  for (let i = 0; i < nights; i += 1) {
    const date = addDays(checkIn, i);
    rows.push(calculateDynamicNightPrice({ date, now, occupancyRate, config }));
  }
  return rows;
};
