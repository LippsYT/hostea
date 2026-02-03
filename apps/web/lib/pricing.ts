import { differenceInCalendarDays } from 'date-fns';
import { CancelPolicy } from '@prisma/client';

export type PricingInput = {
  checkIn: Date;
  checkOut: Date;
  pricePerNight: number;
  cleaningFee: number;
  serviceFee: number;
  taxRate: number;
};

export const calculatePrice = ({ checkIn, checkOut, pricePerNight, cleaningFee, serviceFee, taxRate }: PricingInput) => {
  const nights = Math.max(differenceInCalendarDays(checkOut, checkIn), 1);
  const subtotal = nights * pricePerNight + cleaningFee + serviceFee;
  const taxes = subtotal * taxRate;
  const total = subtotal + taxes;
  return {
    nights,
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
