import { describe, expect, it } from 'vitest';
import { calculatePrice, calculateRefund } from '../apps/web/lib/pricing';
import { CancelPolicy } from '@prisma/client';

describe('pricing', () => {
  it('calcula total con taxes', () => {
    const result = calculatePrice({
      checkIn: new Date('2026-01-10'),
      checkOut: new Date('2026-01-12'),
      pricePerNight: 100,
      cleaningFee: 10,
      serviceFee: 5,
      taxRate: 0.1
    });
    expect(result.nights).toBe(2);
    expect(result.subtotal).toBe(215);
    expect(result.taxes).toBeCloseTo(21.5, 2);
    expect(result.total).toBeCloseTo(236.5, 2);
  });

  it('aplica politica de cancelacion', () => {
    const refund = calculateRefund({
      policy: CancelPolicy.MODERATE,
      checkIn: new Date('2026-02-10T10:00:00Z'),
      cancelAt: new Date('2026-02-09T10:00:00Z'),
      windowHours: 48,
      partialRefundPercent: 0.5
    });
    expect(refund).toBe(0.25);
  });
});
