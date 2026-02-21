import { describe, expect, it } from 'vitest';
import { calcBreakdown, calcClientPriceFromHostNet } from '../apps/web/lib/intelligent-pricing';

const params = {
  stripePct: 0.07,
  stripeFixed: 0.5,
  platformPct: 0.15
};

describe('intelligent pricing', () => {
  it('calculates client price from host net', () => {
    const clientPrice = calcClientPriceFromHostNet(40, params);
    expect(clientPrice).toBeCloseTo(51.14, 2);
  });

  it('returns host net close to desired value (hostNet=40)', () => {
    const desired = 40;
    const clientPrice = calcClientPriceFromHostNet(desired, params);
    const breakdown = calcBreakdown(clientPrice, params);
    expect(breakdown.hostNet).toBeCloseTo(desired, 1);
  });
});
