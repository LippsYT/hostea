export type SmartPricingParams = {
  stripePct: number;
  stripeFixed: number;
  platformPct: number;
};

const round2 = (value: number) => Math.round(value * 100) / 100;

const toNumber = (value: unknown, fallback: number) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

export const defaultSmartPricingParams: SmartPricingParams = {
  stripePct: toNumber(process.env.STRIPE_PCT ?? process.env.NEXT_PUBLIC_STRIPE_PCT, 0.07),
  stripeFixed: toNumber(process.env.STRIPE_FIXED ?? process.env.NEXT_PUBLIC_STRIPE_FIXED, 0.5),
  platformPct: toNumber(process.env.PLATFORM_PCT ?? process.env.NEXT_PUBLIC_PLATFORM_PCT, 0.15)
};

export const withSmartPricingParams = (
  partial?: Partial<SmartPricingParams>
): SmartPricingParams => ({
  stripePct: toNumber(partial?.stripePct, defaultSmartPricingParams.stripePct),
  stripeFixed: toNumber(partial?.stripeFixed, defaultSmartPricingParams.stripeFixed),
  platformPct: toNumber(partial?.platformPct, defaultSmartPricingParams.platformPct)
});

export const calcClientPriceFromHostNet = (
  hostNet: number,
  params?: Partial<SmartPricingParams>
) => {
  const safeHostNet = Math.max(0, Number(hostNet) || 0);
  const cfg = withSmartPricingParams(params);
  const denominator = 1 - cfg.stripePct;
  const platformBase = 1 - cfg.platformPct;

  if (denominator <= 0 || platformBase <= 0) return 0;

  const price = (safeHostNet / platformBase + cfg.stripeFixed) / denominator;
  return round2(Math.max(0, price));
};

export const calcBreakdown = (price: number, params?: Partial<SmartPricingParams>) => {
  const safePrice = Math.max(0, Number(price) || 0);
  const cfg = withSmartPricingParams(params);

  const stripeFee = safePrice * cfg.stripePct + cfg.stripeFixed;
  const afterStripe = safePrice - stripeFee;
  const platformFee = afterStripe * cfg.platformPct;
  const hostNet = afterStripe - platformFee;

  return {
    stripeFee: round2(stripeFee),
    afterStripe: round2(afterStripe),
    platformFee: round2(platformFee),
    hostNet: round2(hostNet)
  };
};
