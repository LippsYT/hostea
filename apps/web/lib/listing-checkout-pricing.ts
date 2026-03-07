import { addDays, differenceInCalendarDays, isWithinInterval } from 'date-fns';
import {
  calcBreakdown,
  calcClientPriceFromHostNet,
  type SmartPricingParams,
  withSmartPricingParams
} from '@/lib/intelligent-pricing';

const round2 = (value: number) => Math.round((Number(value) || 0) * 100) / 100;

export type ListingPriceOverride = {
  startDate: Date;
  endDate: Date;
  price: number;
};

export type ListingCheckoutQuoteInput = {
  checkIn: Date;
  checkOut: Date;
  pricePerNight: number;
  netoDeseadoUsd?: number | null;
  precioClienteCalculadoUsd?: number | null;
  cleaningFee: number;
  taxRate: number;
  overrides?: ListingPriceOverride[];
  pricingParams?: Partial<SmartPricingParams>;
};

export type ListingCheckoutQuote = {
  nights: number;
  hostNightlySubtotal: number;
  adminCharges: number;
  platformFee: number;
  subtotalBeforeTax: number;
  taxes: number;
  total: number;
};

const getNightPrice = (day: Date, basePrice: number, overrides?: ListingPriceOverride[]) => {
  const override = overrides?.find((item) =>
    isWithinInterval(day, { start: item.startDate, end: item.endDate })
  );
  return Number.isFinite(Number(override?.price)) ? Number(override?.price) : basePrice;
};

export const calculateListingCheckoutQuote = ({
  checkIn,
  checkOut,
  pricePerNight,
  netoDeseadoUsd,
  precioClienteCalculadoUsd,
  cleaningFee,
  taxRate,
  overrides,
  pricingParams
}: ListingCheckoutQuoteInput): ListingCheckoutQuote => {
  const nights = Math.max(differenceInCalendarDays(checkOut, checkIn), 1);
  const cleanFee = round2(cleaningFee);
  const normalizedTaxRate = Number(taxRate) > 1 ? Number(taxRate) / 100 : Number(taxRate) || 0;

  const explicitNet = Number.isFinite(Number(netoDeseadoUsd)) ? Number(netoDeseadoUsd) : null;
  const explicitClient = Number.isFinite(Number(precioClienteCalculadoUsd))
    ? Number(precioClienteCalculadoUsd)
    : null;
  const hasSmartPricingReference =
    explicitNet !== null && explicitNet >= 0 && explicitClient !== null && explicitClient > 0;
  const hostPerClientRatio =
    hasSmartPricingReference && explicitClient
      ? Math.max(0, explicitNet! / explicitClient)
      : null;

  let hostNightlySubtotal = 0;

  for (let dayIndex = 0; dayIndex < nights; dayIndex += 1) {
    const day = addDays(checkIn, dayIndex);
    const nightlyRaw = getNightPrice(day, Number(pricePerNight) || 0, overrides);

    if (hasSmartPricingReference && hostPerClientRatio !== null) {
      hostNightlySubtotal += nightlyRaw * hostPerClientRatio;
    } else {
      // Legacy listings without explicit smart-pricing fields are treated as host net base.
      hostNightlySubtotal += nightlyRaw;
    }
  }

  const roundedHostNightly = round2(hostNightlySubtotal);
  const clientSubtotalEstimated = calcClientPriceFromHostNet(roundedHostNightly, pricingParams);
  const feeBreakdown = calcBreakdown(clientSubtotalEstimated, pricingParams);

  const adminCharges = round2(feeBreakdown.stripeFee);
  const platformFee = round2(feeBreakdown.platformFee);
  const subtotalBeforeTax = round2(roundedHostNightly + adminCharges + platformFee + cleanFee);
  const taxes = round2(subtotalBeforeTax * normalizedTaxRate);
  const total = round2(subtotalBeforeTax + taxes);

  return {
    nights,
    hostNightlySubtotal: roundedHostNightly,
    adminCharges,
    platformFee,
    subtotalBeforeTax,
    taxes,
    total
  };
};
