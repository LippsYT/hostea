import { addDays, differenceInCalendarDays, isWithinInterval } from 'date-fns';
import { CancelPolicy } from '@prisma/client';

export type PricingInput = {
  checkIn: Date;
  checkOut: Date;
  pricePerNight: number;
  cleaningFee: number;
  serviceFee: number;
  taxRate: number;
  overrides?: { startDate: Date; endDate: Date; price: number }[];
};

export const calculatePrice = ({
  checkIn,
  checkOut,
  pricePerNight,
  cleaningFee,
  serviceFee,
  taxRate,
  overrides
}: PricingInput) => {
  const nights = Math.max(differenceInCalendarDays(checkOut, checkIn), 1);
  let nightlySubtotal = 0;
  for (let i = 0; i < nights; i += 1) {
    const day = addDays(checkIn, i);
    const override = overrides?.find((o) =>
      isWithinInterval(day, { start: o.startDate, end: o.endDate })
    );
    nightlySubtotal += override?.price ?? pricePerNight;
  }
  const subtotal = nightlySubtotal + cleaningFee + serviceFee;
  const taxes = subtotal * taxRate;
  const total = subtotal + taxes;
  return {
    nights,
    nightlySubtotal,
    subtotal,
    taxes,
    total
  };
};

export const calculateRefund = ({
  policy,
  checkIn,
  cancelAt,
  windowHours,
  partialRefundPercent
}: {
  policy: CancelPolicy;
  checkIn: Date;
  cancelAt: Date;
  windowHours: number;
  partialRefundPercent: number;
}) => {
  const hoursToCheckIn = (checkIn.getTime() - cancelAt.getTime()) / (1000 * 60 * 60);
  if (hoursToCheckIn >= windowHours) {
    return 1;
  }
  if (policy === CancelPolicy.FLEXIBLE) {
    return partialRefundPercent;
  }
  if (policy === CancelPolicy.MODERATE) {
    return partialRefundPercent * 0.5;
  }
  return 0;
};
