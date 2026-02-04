import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { redirect } from 'next/navigation';
import { getSetting } from '@/lib/settings';
import { calculateHostSplit } from '@/lib/finance';
import { HostBankForm } from '@/components/host-bank-form';
import { ReservationStatus } from '@prisma/client';
import { reservationStatusBadgeClass, reservationStatusLabel } from '@/lib/reservation-status';
import { Badge } from '@/components/ui/badge';

export default async function HostFinancePage() {
  const session = await getServerSession(authOptions);
  const roles = (session?.user as any)?.roles || [];
  if (!roles.includes('HOST') && !roles.includes('ADMIN')) {
    redirect('/dashboard');
  }
  const userId = (session?.user as any)?.id as string;
  const commissionPercent = await getSetting<number>('commissionPercent', 0.15);
  const usdToArsRate = await getSetting<number>('usdToArsRate', 980);

  const reservations = await prisma.reservation.findMany({
    where: {
      listing: { hostId: userId },
      status: { in: [ReservationStatus.CONFIRMED, ReservationStatus.CHECKED_IN, ReservationStatus.COMPLETED] }
    },
    include: { payment: true, listing: true, user: { include: { profile: true } } },
    orderBy: { createdAt: 'desc' }
  });

  const payouts = await prisma.payout.findMany({ where: { hostId: userId } });
  const payoutMap = payouts.reduce<Record<string, number>>((acc, p) => {
    acc[p.reservationId] = (acc[p.reservationId] || 0) + Number(p.amount);
    return acc;
  }, {});

  const rows = reservations
    .filter((r) => r.payment?.status === 'SUCCEEDED')
    .map((r) => {
      const total = Number(r.total);
      const split = calculateHostSplit(total, commissionPercent);
      const paid = payoutMap[r.id] || 0;
      const due = Math.max(split.host - paid, 0);
      return {
        id: r.id,
        listingTitle: r.listing.title,
        guestName: r.user.profile?.name || r.user.email || 'Huésped',
        status: r.status,
        total,
        commission: split.commission,
        host: split.host,
        paid,
        due,
        checkIn: r.checkIn.toISOString().slice(0, 10),
        checkOut: r.checkOut.toISOString().slice(0, 10)
      };
    });

  const totals = rows.reduce(
    (acc, r) => {
      acc.total += r.total;
      acc.commission += r.commission;
      acc.host += r.host;
      acc.paid += r.paid;
      acc.due += r.due;
      return acc;
    },
    { total: 0, commission: 0, host: 0, paid: 0, due: 0 }
  );

  return (
    <div className="space-y-8">
      <div>
        <p className="section-subtitle">Panel Host</p>
        <h1 className="section-title">Finanzas y liquidaciones</h1>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="stat-card">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Generado</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">USD {totals.total.toFixed(2)}</p>
          <p className="text-xs text-slate-500">ARS {Math.round(totals.total * usdToArsRate)}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Comisión plataforma</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">USD {totals.commission.toFixed(2)}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Pagado</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">USD {totals.paid.toFixed(2)}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Pendiente</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">USD {totals.due.toFixed(2)}</p>
        </div>
      </div>

      <HostBankForm />

      <div className="surface-card">
        <h2 className="text-xl font-semibold text-slate-900">Detalle de reservas</h2>
        <div className="mt-5 space-y-3 text-sm">
          {rows.map((r) => (
            <div key={r.id} className="surface-muted flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-slate-900">{r.guestName}</p>
                <p className="text-xs text-slate-500">{r.listingTitle} · {r.checkIn} - {r.checkOut}</p>
                <Badge className={reservationStatusBadgeClass(r.status)}>
                  {reservationStatusLabel(r.status)}
                </Badge>
              </div>
              <div className="text-right text-slate-600">
                <p>Total USD {r.total.toFixed(2)}</p>
                <p>Host USD {r.host.toFixed(2)} · Pendiente USD {r.due.toFixed(2)}</p>
              </div>
            </div>
          ))}
          {rows.length === 0 && <p className="text-sm text-slate-500">No hay pagos confirmados aun.</p>}
        </div>
      </div>
    </div>
  );
}
