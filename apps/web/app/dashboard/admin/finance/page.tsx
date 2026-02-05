import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { redirect } from 'next/navigation';
import { getSetting } from '@/lib/settings';
import { calculateHostSplit } from '@/lib/finance';
import { AdminFinance } from '@/components/admin-finance';
import {
  ADJUSTMENT_STATUSES,
  FinanceRow,
  REVENUE_STATUSES,
  getPeriodKey,
  isPaymentCaptured
} from '@/lib/finance-report';

export default async function AdminFinancePage({
  searchParams
}: {
  searchParams?: { period?: string; hostId?: string };
}) {
  const session = await getServerSession(authOptions);
  const roles = (session?.user as any)?.roles || [];
  if (!roles.includes('ADMIN')) {
    redirect('/dashboard');
  }

  const commissionPercent = await getSetting<number>('commissionPercent', 0.15);

  const reservations = await prisma.reservation.findMany({
    where: { payment: { status: { in: ['SUCCEEDED', 'REFUNDED'] } } },
    include: {
      listing: { include: { host: { include: { profile: true } } } },
      payment: true,
      user: { include: { profile: true } }
    },
    orderBy: { createdAt: 'desc' }
  });

  const payouts = await prisma.payout.findMany();
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

  const hostRows = reservations.reduce<Record<string, { hostId: string; hostName: string; hostEmail: string }>>(
    (acc, r) => {
      const hostId = r.listing.hostId;
      if (!acc[hostId]) {
        acc[hostId] = {
          hostId,
          hostName: r.listing.host.profile?.name || r.listing.host.email,
          hostEmail: r.listing.host.email
        };
      }
      return acc;
    },
    {}
  );

  const hostList = Object.values(hostRows);
  const hostIds = hostList.map((h) => h.hostId);
  const bankRows = await prisma.settings.findMany({
    where: { key: { in: hostIds.map((id) => `hostBankAccount:${id}`) } }
  });
  const bankMap = bankRows.reduce<Record<string, any>>((acc, row) => {
    acc[row.key] = row.value;
    return acc;
  }, {});

  const hostBank = hostList.map((host) => ({
    ...host,
    bankAccount: bankMap[`hostBankAccount:${host.hostId}`] || null
  }));

  const archiveRows = await prisma.settings.findMany({
    where: { key: { startsWith: 'financeArchive:' } }
  });
  const archiveMap = archiveRows.reduce<Record<string, string[]>>((acc, row) => {
    acc[row.key.replace('financeArchive:', '')] = (row.value as any)?.months || [];
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div>
        <p className="section-subtitle">Panel Admin</p>
        <h1 className="section-title">Finanzas y liquidaciones</h1>
      </div>
      <AdminFinance
        rows={rows}
        hosts={hostBank}
        payouts={payouts.map((p) => ({
          id: p.id,
          reservationId: p.reservationId,
          hostId: p.hostId,
          amount: Number(p.amount),
          currency: p.currency,
          status: p.status,
          createdAt: p.createdAt.toISOString().slice(0, 10)
        }))}
        archiveMap={archiveMap}
      />
    </div>
  );
}
