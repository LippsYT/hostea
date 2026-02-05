import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { ReservationStatus, PaymentStatus } from '@prisma/client';

export const REVENUE_STATUSES = new Set<ReservationStatus>([
  ReservationStatus.CONFIRMED,
  ReservationStatus.CHECKED_IN,
  ReservationStatus.COMPLETED
]);

export const ADJUSTMENT_STATUSES = new Set<ReservationStatus>([
  ReservationStatus.CANCELED,
  ReservationStatus.REFUNDED,
  ReservationStatus.DISPUTED
]);

export const getPeriodKey = (date: Date) => format(date, 'yyyy-MM');

export const getPeriodLabel = (periodKey: string) => {
  const [year, month] = periodKey.split('-').map(Number);
  if (!year || !month) return periodKey;
  return format(new Date(year, month - 1, 1), 'LLLL yyyy', { locale: es });
};

export const formatMoney = (amount: number, currency = 'USD') =>
  new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2
  }).format(amount);

export const isPaymentCaptured = (status?: PaymentStatus | null) =>
  status === PaymentStatus.SUCCEEDED || status === PaymentStatus.REFUNDED;

export type FinanceRow = {
  id: string;
  hostId: string;
  listingTitle: string;
  guestName: string;
  status: ReservationStatus;
  total: number;
  commission: number;
  hostNet: number;
  currency: string;
  period: string;
  date: string;
  paymentMethod: string;
  impact: 'revenue' | 'adjustment';
};

export type FinancePeriodTotals = {
  period: string;
  gross: number;
  adjustments: number;
  commission: number;
  hostNet: number;
};

export const emptyTotals = () => ({ gross: 0, adjustments: 0, commission: 0, hostNet: 0 });

export const addTotals = (base: FinancePeriodTotals, add: Partial<FinancePeriodTotals>) => {
  base.gross += add.gross || 0;
  base.adjustments += add.adjustments || 0;
  base.commission += add.commission || 0;
  base.hostNet += add.hostNet || 0;
};

export const buildPeriodTotals = (rows: FinanceRow[], periods: string[]) => {
  const map = new Map<string, FinancePeriodTotals>();
  periods.forEach((period) => map.set(period, { period, ...emptyTotals() }));

  rows.forEach((row) => {
    const target = map.get(row.period) || { period: row.period, ...emptyTotals() };
    if (row.impact === 'revenue') {
      target.gross += row.total;
    } else {
      target.adjustments -= Math.abs(row.total);
    }
    target.commission += row.commission;
    target.hostNet += row.hostNet;
    map.set(row.period, target);
  });

  return periods.map((period) => map.get(period) || { period, ...emptyTotals() });
};
