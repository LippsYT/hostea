import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { redirect } from 'next/navigation';
import { getSetting } from '@/lib/settings';
import { differenceInCalendarDays } from 'date-fns';
import {
  ADJUSTMENT_STATUSES,
  FinanceRow,
  REVENUE_STATUSES,
  buildPeriodTotals,
  getPeriodKey,
  getPeriodLabel,
  isPaymentCaptured
} from '@/lib/finance-report';
import { FinanceReportView, FinanceListingSummary, FinanceReportRow } from '@/components/finance-report-view';

export default async function AdminFinanceReportPage({
  params,
  searchParams
}: {
  params: { yearMonth: string };
  searchParams?: { hostId?: string };
}) {
  const session = await getServerSession(authOptions);
  const roles = (session?.user as any)?.roles || [];
  if (!roles.includes('ADMIN')) {
    redirect('/dashboard');
  }

  const commissionPercent = await getSetting<number>('commissionPercent', 0.15);
  const period = params.yearMonth;
  const hostId = searchParams?.hostId;

  const reservations = await prisma.reservation.findMany({
    where: {
      listing: hostId ? { hostId } : undefined,
      payment: { status: { in: ['SUCCEEDED', 'REFUNDED'] } }
    },
    include: {
      listing: { include: { host: { include: { profile: true } } } },
      payment: true,
      user: { include: { profile: true } }
    },
    orderBy: { createdAt: 'desc' }
  });

  const rows: FinanceRow[] = reservations
    .filter((r) => isPaymentCaptured(r.payment?.status))
    .map((r) => {
      const total = Number(r.total);
      const isRevenue = REVENUE_STATUSES.has(r.status);
      const isAdjustment = ADJUSTMENT_STATUSES.has(r.status) || r.payment?.status === 'REFUNDED';
      if (!isRevenue && !isAdjustment) return null;
      const sign = isRevenue ? 1 : -1;
      const commission = total * commissionPercent * sign;
      const hostNet = (total - total * commissionPercent) * sign;
      const date = r.payment?.createdAt || r.createdAt;
      return {
        id: r.id,
        hostId: r.listing.hostId,
        listingTitle: r.listing.title,
        guestName: r.user.profile?.name || r.user.email || 'Huesped',
        status: r.status,
        total: total * sign,
        commission,
        hostNet,
        currency: r.currency,
        period: getPeriodKey(date),
        date: date.toISOString().slice(0, 10),
        paymentMethod: 'Stripe',
        impact: isRevenue ? 'revenue' : 'adjustment'
      };
    })
    .filter(Boolean) as FinanceRow[];

  const periodRows = rows.filter((r) => r.period === period);
  const totals = buildPeriodTotals(periodRows, [period])[0];

  const nights = reservations
    .filter((r) => getPeriodKey(r.payment?.createdAt || r.createdAt) === period)
    .reduce((acc, r) => acc + Math.max(differenceInCalendarDays(r.checkOut, r.checkIn), 1), 0);
  const stays = periodRows.length;
  const avgNights = stays > 0 ? nights / stays : 0;

  const listingSummaryMap = new Map<string, FinanceListingSummary>();
  periodRows.forEach((row) => {
    const entry = listingSummaryMap.get(row.listingTitle) || {
      listingTitle: row.listingTitle,
      gross: 0,
      adjustments: 0,
      commission: 0,
      hostNet: 0,
      currency: row.currency
    };
    if (row.impact === 'revenue') {
      entry.gross += row.total;
    } else {
      entry.adjustments += row.total;
    }
    entry.commission += row.commission;
    entry.hostNet += row.hostNet;
    listingSummaryMap.set(row.listingTitle, entry);
  });

  const reportRows: FinanceReportRow[] = periodRows.map((row) => ({
    id: row.id,
    reservationId: row.id,
    guestName: row.guestName,
    listingTitle: row.listingTitle,
    status: row.status,
    date: row.date,
    total: row.total,
    commission: row.commission,
    hostNet: row.hostNet,
    currency: row.currency,
    hostName:
      reservations.find((r) => r.id === row.id)?.listing.host.profile?.name ||
      reservations.find((r) => r.id === row.id)?.listing.host.email
  }));

  return (
    <FinanceReportView
      title="Informe mensual (Admin)"
      periodLabel={getPeriodLabel(period)}
      totals={{ ...totals, currency: periodRows[0]?.currency || 'USD' }}
      stats={{ nights, stays, avgNights }}
      rows={reportRows}
      listings={Array.from(listingSummaryMap.values())}
    />
  );
}
