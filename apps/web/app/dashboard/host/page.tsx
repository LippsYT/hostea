import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { HostDashboard } from '@/components/host-dashboard';
import { Card } from '@/components/ui/card';
import { StripeConnectButton } from '@/components/stripe-connect-button';
import { redirect } from 'next/navigation';
import { getSetting } from '@/lib/settings';

export default async function HostPage() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string;
  const roles = (session?.user as any)?.roles || [];
  if (!roles.includes('HOST') && !roles.includes('ADMIN')) {
    redirect('/dashboard');
  }

  const listings = await prisma.listing.findMany({ where: { hostId: userId } });
  const reservations = await prisma.reservation.findMany({ where: { listing: { hostId: userId } } });
  const usdToArsRate = await getSetting<number>('usdToArsRate', 980);
  const connectEnabled = process.env.ENABLE_STRIPE_CONNECT === 'true';

  const data = [
    { name: 'Ago', revenue: 420 },
    { name: 'Sep', revenue: 980 },
    { name: 'Oct', revenue: 730 },
    { name: 'Nov', revenue: 1200 },
    { name: 'Dic', revenue: 860 },
    { name: 'Ene', revenue: 1400 }
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="section-subtitle">Panel Host</p>
          <h1 className="section-title">Gestion de propiedades</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <a className="pill-link" href="/dashboard/host/listings">Gestion de listings</a>
          <a className="pill-link" href="/dashboard/host/reservations">Reservas</a>
          <a className="pill-link" href="/dashboard/host/calendar">Calendario</a>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="stat-card">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Propiedades</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{listings.length}</p>
          <p className="mt-1 text-xs text-slate-500">Activas y en revision</p>
        </Card>
        <Card className="stat-card">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Reservas</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{reservations.length}</p>
          <p className="mt-1 text-xs text-slate-500">Ultimos 30 dias</p>
        </Card>
        <Card className="stat-card">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Ocupacion</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">78%</p>
          <p className="mt-1 text-xs text-slate-500">Promedio mensual</p>
        </Card>
        <Card className="stat-card">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">USD a ARS</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{usdToArsRate}</p>
          <p className="mt-1 text-xs text-slate-500">Tipo de cambio manual</p>
        </Card>
      </div>

      {connectEnabled && <StripeConnectButton />}
      <HostDashboard data={data} />
    </div>
  );
}
