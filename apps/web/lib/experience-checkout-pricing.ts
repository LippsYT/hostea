import {
  calcBreakdown,
  calcClientPriceFromHostNet,
  type SmartPricingParams
} from '@/lib/intelligent-pricing';

const round2 = (value: number) => Math.round((Number(value) || 0) * 100) / 100;

export type ExperienceCheckoutQuoteInput = {
  adults: number;
  children: number;
  infants: number;
  adultPrice: number;
  childPrice: number;
  infantPrice: number;
  pricingParams?: Partial<SmartPricingParams>;
};

export type ExperienceCheckoutQuote = {
  hostSubtotal: number;
  guestServiceFee: number;
  adminCharges: number;
  total: number;
};

export const calculateExperienceCheckoutQuote = ({
  adults,
  children,
  infants,
  adultPrice,
  childPrice,
  infantPrice,
  pricingParams
}: ExperienceCheckoutQuoteInput): ExperienceCheckoutQuote => {
  const hostSubtotal = round2(
    Math.max(0, adults) * Math.max(0, adultPrice) +
      Math.max(0, children) * Math.max(0, childPrice) +
      Math.max(0, infants) * Math.max(0, infantPrice)
  );

  const total = round2(calcClientPriceFromHostNet(hostSubtotal, pricingParams));
  const breakdown = calcBreakdown(total, pricingParams);

  return {
    hostSubtotal,
    guestServiceFee: round2(breakdown.guestFee),
    adminCharges: round2(breakdown.stripeFee),
    total
  };
};

