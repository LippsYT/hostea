export type SmartPricingParams = {
  stripePct: number;
  stripeFixed: number;
  platformPct: number;
  guestPct: number;
};

const round2 = (value: number) => Math.round(value * 100) / 100;

const toNumber = (value: unknown, fallback: number) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

export const defaultSmartPricingParams: SmartPricingParams = {
  // Cargos administrativos/procesamiento (opcional). Por defecto 0 para modelo OTA 8% + 7%.
  stripePct: toNumber(
    process.env.PROCESSING_PCT ??
      process.env.STRIPE_PCT ??
      process.env.NEXT_PUBLIC_PROCESSING_PCT ??
      process.env.NEXT_PUBLIC_STRIPE_PCT,
    0
  ),
  stripeFixed: toNumber(
    process.env.PROCESSING_FIXED ??
      process.env.STRIPE_FIXED ??
      process.env.NEXT_PUBLIC_PROCESSING_FIXED ??
      process.env.NEXT_PUBLIC_STRIPE_FIXED,
    0
  ),
  // Comision al anfitrion.
  platformPct: toNumber(
    process.env.HOST_COMMISSION_PCT ??
      process.env.PLATFORM_PCT ??
      process.env.NEXT_PUBLIC_HOST_COMMISSION_PCT ??
      process.env.NEXT_PUBLIC_PLATFORM_PCT,
    0.08
  ),
  // Tarifa de servicio al huesped.
  guestPct: toNumber(
    process.env.GUEST_SERVICE_PCT ?? process.env.NEXT_PUBLIC_GUEST_SERVICE_PCT,
    0.07
  )
};

export const withSmartPricingParams = (
  partial?: Partial<SmartPricingParams>
): SmartPricingParams => ({
  stripePct: toNumber(partial?.stripePct, defaultSmartPricingParams.stripePct),
  stripeFixed: toNumber(partial?.stripeFixed, defaultSmartPricingParams.stripeFixed),
  platformPct: toNumber(partial?.platformPct, defaultSmartPricingParams.platformPct),
  guestPct: toNumber(partial?.guestPct, defaultSmartPricingParams.guestPct)
});

export const calcClientPriceFromHostNet = (
  hostNet: number,
  params?: Partial<SmartPricingParams>
) => {
  const safeHostNet = Math.max(0, Number(hostNet) || 0);
  const cfg = withSmartPricingParams(params);
  const hostBaseDenominator = 1 - cfg.platformPct;
  const guestBaseMultiplier = 1 + cfg.guestPct;
  const processingDenominator = 1 - cfg.stripePct;

  if (hostBaseDenominator <= 0 || guestBaseMultiplier <= 0 || processingDenominator <= 0) return 0;

  const hostBase = safeHostNet / hostBaseDenominator;
  const beforeProcessing = hostBase * guestBaseMultiplier;
  const price = (beforeProcessing + cfg.stripeFixed) / processingDenominator;
  return round2(Math.max(0, price));
};

export const calcBreakdown = (price: number, params?: Partial<SmartPricingParams>) => {
  const safePrice = Math.max(0, Number(price) || 0);
  const cfg = withSmartPricingParams(params);

  const stripeFee = safePrice * cfg.stripePct + cfg.stripeFixed;
  const afterStripe = Math.max(0, safePrice - stripeFee);
  const hostBase = cfg.guestPct >= -1 ? afterStripe / (1 + cfg.guestPct) : 0;
  const guestFee = afterStripe - hostBase;
  const platformFee = hostBase * cfg.platformPct;
  const hostNet = hostBase - platformFee;

  return {
    stripeFee: round2(stripeFee),
    afterStripe: round2(afterStripe),
    hostBase: round2(hostBase),
    guestFee: round2(guestFee),
    platformFee: round2(platformFee),
    hostNet: round2(hostNet)
  };
};
