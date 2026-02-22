import { describe, expect, it } from 'vitest';
import {
  buildDynamicBreakdown,
  normalizeDynamicPricingConfig
} from '../apps/web/lib/dynamic-pricing';

describe('dynamic pricing', () => {
  it('keeps all computed prices inside min/max boundaries', () => {
    const config = normalizeDynamicPricingConfig(
      { enabled: true, basePrice: 70, minPrice: 50, maxPrice: 120 },
      70
    );
    const rows = buildDynamicBreakdown({
      checkIn: new Date('2026-03-01'),
      checkOut: new Date('2026-03-06'),
      occupancyRate: 0.9,
      config,
      now: new Date('2026-02-28')
    });

    expect(rows.length).toBe(5);
    expect(rows.every((row) => row.finalPrice >= 50 && row.finalPrice <= 120)).toBe(true);
  });

  it('charges more on weekend than weekday with same context', () => {
    const config = normalizeDynamicPricingConfig(
      { enabled: true, basePrice: 100, minPrice: 60, maxPrice: 180 },
      100
    );
    const [friday] = buildDynamicBreakdown({
      checkIn: new Date('2026-03-06'),
      checkOut: new Date('2026-03-07'),
      occupancyRate: 0.5,
      config,
      now: new Date('2026-03-01')
    });
    const [monday] = buildDynamicBreakdown({
      checkIn: new Date('2026-03-09'),
      checkOut: new Date('2026-03-10'),
      occupancyRate: 0.5,
      config,
      now: new Date('2026-03-01')
    });

    expect(friday.finalPrice).toBeGreaterThan(monday.finalPrice);
  });
});
