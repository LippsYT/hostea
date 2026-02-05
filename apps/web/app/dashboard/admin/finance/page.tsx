import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { redirect } from 'next/navigation';
import { getSetting } from '@/lib/settings';
import { calculateHostSplit } from '@/lib/finance';
import { AdminFinance } from '@/components/admin-finance';

export default async function AdminFinancePage() {
  const session = await getServerSession(authOptions);
  const roles = (session?.user as any)?.roles || [];
  if (!roles.includes('ADMIN')) {
    redirect('/dashboard');
  }

  const commissionPercent = await getSetting<number>('commissionPercent', 0.15);

  const reservations = await prisma.reservation.findMany({
    where: { payment: { status: 'SUCCEEDED' } },
    include: { listing: { include: { host: true } }, payment: true },
    orderBy: { createdAt: 'desc' }
  });

  const payouts = await prisma.payout.findMany();
  const payoutMap = payouts.reduce<Record<string, number>>((acc, p) => {
    acc[p.reservationId] = (acc[p.reservationId] || 0) + Number(p.amount);
    return acc;
  }, {});

  const rows = reservations.map((r) => {
    const total = Number(r.total);
    const split = calculateHostSplit(total, commissionPercent);
    const paid = payoutMap[r.id] || 0;
    const due = Math.max(split.host - paid, 0);
    return {
      id: r.id,
      listingTitle: r.listing.title,
      hostId: r.listing.host.id,
      hostName: r.listing.host.email,
      hostEmail: r.listing.host.email,
      total,
      hostAmount: split.host,
      paid,
      due
    };
  });

  const hostIds = Array.from(new Set(rows.map((row) => row.hostId)));
  const bankKeys = hostIds.map((id) => `hostBankAccount:${id}`);
  const bankRows = await prisma.settings.findMany({
    where: { key: { in: bankKeys } }
  });
  const bankMap = bankRows.reduce<Record<string, any>>((acc, row) => {
    acc[row.key] = row.value;
    return acc;
  }, {});

  const hostMap = rows.reduce<Record<string, { hostId: string; hostName: string; hostEmail: string; total: number; paid: number; due: number }>>((acc, row) => {
    if (!acc[row.hostId]) {
      acc[row.hostId] = { hostId: row.hostId, hostName: row.hostName, hostEmail: row.hostEmail, total: 0, paid: 0, due: 0 };
    }
    acc[row.hostId].total += row.total;
    acc[row.hostId].paid += row.paid;
    acc[row.hostId].due += row.due;
    return acc;
  }, {});

  const hostRows = Object.values(hostMap).map((totals) => ({
    hostId: totals.hostId,
    hostName: totals.hostName,
    hostEmail: totals.hostEmail,
    total: totals.total,
    paid: totals.paid,
    due: totals.due,
    bankAccount: bankMap[`hostBankAccount:${totals.hostId}`] || null
  }));

  return (
    <div className="space-y-6">
      <div>
        <p className="section-subtitle">Panel Admin</p>
        <h1 className="section-title">Finanzas y liquidaciones</h1>
      </div>
      <AdminFinance reservations={rows.filter((r) => r.due > 0)} hosts={hostRows} />
    </div>
  );
}
