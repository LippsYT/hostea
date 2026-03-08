import { getSetting } from '@/lib/settings';
import { defaultSmartPricingParams, withSmartPricingParams } from '@/lib/intelligent-pricing';

export const getSmartPricingParamsFromSettings = async () => {
  const hostCommissionPct = await getSetting<number>(
    'hostCommissionPercent',
    await getSetting<number>('commissionPercent', defaultSmartPricingParams.platformPct)
  );
  const guestServicePct = await getSetting<number>(
    'guestServicePercent',
    defaultSmartPricingParams.guestPct
  );
  const processingPct = await getSetting<number>(
    'processingPercent',
    defaultSmartPricingParams.stripePct
  );
  const processingFixed = await getSetting<number>(
    'processingFixed',
    defaultSmartPricingParams.stripeFixed
  );

  return withSmartPricingParams({
    platformPct: hostCommissionPct,
    guestPct: guestServicePct,
    stripePct: processingPct,
    stripeFixed: processingFixed
  });
};
