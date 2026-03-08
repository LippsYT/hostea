import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getEffectiveRoles } from '@/lib/server-roles';
import { prisma } from '@/lib/db';
import { redirect } from 'next/navigation';
import { getSetting } from '@/lib/settings';
import { calculateHostSplit } from '@/lib/finance';
import { HostFinanceDashboard } from '@/components/host-finance-dashboard';
import {
  ADJUSTMENT_STATUSES,
  FinanceRow,
  REVENUE_STATUSES,
  getPeriodKey,
  isPaymentCaptured
} from '@/lib/finance-report';

export default async function HostFinancePage({
  searchParams
}: {
  searchParams?: { period?: string; view?: string };
}) {
  const session = await getServerSession(authOptions);
  const sessionUserId = (session?.user as any)?.id as string | undefined;
  const roles = await getEffectiveRoles(sessionUserId, (session?.user as any)?.roles);
  if (!roles.includes('HOST') && !roles.includes('ADMIN')) {
    redirect('/dashboard');
  }
  const userId = (session?.user as any)?.id as string;
  const commissionPercent = await getSetting<number>(
    'hostCommissionPercent',
    await getSetting<number>('commissionPercent', 0.08)
  );

  const reservations = await prisma.reservation.findMany({
    where: {
      listing: { hostId: userId },
      payment: { status: { in: ['SUCCEEDED', 'REFUNDED'] } }
    },
    include: { payment: true, listing: true, user: { include: { profile: true } } },
    orderBy: { createdAt: 'desc' }
  });

  const payouts = await prisma.payout.findMany({ where: { hostId: userId } });
  const payoutMap = payouts.reduce<Record<string, number>>((acc, p) => {
    acc[p.reservationId] = (acc[p.reservationId] || 0) + Number(p.amount);
    return acc;
  }, {});

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

  const scheduled = reservations
    .filter((r) => isPaymentCaptured(r.payment?.status))
    .filter((r) => REVENUE_STATUSES.has(r.status))
    .map((r) => {
      const total = Number(r.total);
      const split = calculateHostSplit(total, commissionPercent);
      const paid = payoutMap[r.id] || 0;
      const due = Math.max(split.host - paid, 0);
      const eta = new Date(r.checkOut);
      eta.setDate(eta.getDate() + 2);
      return {
        id: r.id,
        listingTitle: r.listing.title,
        guestName: r.user.profile?.name || r.user.email || 'Huesped',
        amount: due,
        currency: r.currency,
        eta: eta.toISOString().slice(0, 10),
        period: getPeriodKey(r.payment?.createdAt || r.createdAt)
      };
    })
    .filter((item) => item.amount > 0);

  const paid = payouts.map((p) => ({
    id: p.id,
    reservationId: p.reservationId,
    amount: Number(p.amount),
    currency: p.currency,
    createdAt: p.createdAt.toISOString().slice(0, 10)
  }));

  const bankSettings = await prisma.settings.findUnique({
    where: { key: `hostBankAccount:${userId}` }
  });

  const archiveSettings = await prisma.settings.findUnique({
    where: { key: `financeArchive:${userId}` }
  });

  const archiveMonths = (archiveSettings?.value as any)?.months || [];

  return (
    <HostFinanceDashboard
      rows={rows}
      scheduled={scheduled}
      paid={paid}
      bankAccount={bankSettings?.value || null}
      archiveMonths={archiveMonths}
      selectedPeriod={searchParams?.period}
    />
  );
}
