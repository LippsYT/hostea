import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getEffectiveRoles } from '@/lib/server-roles';
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
import { calcBreakdown, defaultSmartPricingParams } from '@/lib/intelligent-pricing';

export default async function HostFinanceReportPage({
  params
}: {
  params: { yearMonth: string };
}) {
  const session = await getServerSession(authOptions);
  const sessionUserId = (session?.user as any)?.id as string | undefined;
  const roles = await getEffectiveRoles(sessionUserId, (session?.user as any)?.roles);
  if (!roles.includes('HOST') && !roles.includes('ADMIN')) {
    redirect('/dashboard');
  }
  const userId = (session?.user as any)?.id as string;
  const commissionPercent = await getSetting<number>('commissionPercent', 0.15);
  const period = params.yearMonth;

  const reservations = await prisma.reservation.findMany({
    where: {
      listing: { hostId: userId },
      payment: { status: { in: ['SUCCEEDED', 'REFUNDED'] } }
    },
    include: { payment: true, listing: true, user: { include: { profile: true } } },
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
        hostId: userId,
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

  const reportRows: FinanceReportRow[] = periodRows.map((row) => {
    const reservation = reservations.find((r) => r.id === row.id);
    const totalAbs = Math.abs(row.total);
    const breakdown = calcBreakdown(totalAbs, defaultSmartPricingParams);
    return {
      id: row.id,
      reservationId: row.id,
      reservationNumber: reservation?.reservationNumber || null,
      guestName: row.guestName,
      listingTitle: row.listingTitle,
      status: row.status,
      checkIn: reservation?.checkIn.toISOString().slice(0, 10) || row.date,
      checkOut: reservation?.checkOut.toISOString().slice(0, 10) || row.date,
      baseAmount: totalAbs,
      adminCharges: breakdown.stripeFee,
      serviceFee: Math.abs(row.commission),
      hostNet: row.hostNet,
      currency: row.currency
    };
  });

  const host = reservations[0]?.listing?.hostId
    ? {
        name: (session?.user as any)?.name || (session?.user as any)?.email || 'Host',
        email: (session?.user as any)?.email || ''
      }
    : null;

  return (
    <FinanceReportView
      title="Informe mensual"
      periodLabel={getPeriodLabel(period)}
      host={host}
      totals={{ ...totals, currency: periodRows[0]?.currency || 'USD' }}
      stats={{ nights, stays, avgNights }}
      rows={reportRows}
      listings={Array.from(listingSummaryMap.values())}
    />
  );
}
