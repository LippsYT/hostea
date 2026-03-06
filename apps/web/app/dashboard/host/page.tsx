import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getEffectiveRoles } from '@/lib/server-roles';
import { prisma } from '@/lib/db';
import { HostDashboard } from '@/components/host-dashboard';
import { Card } from '@/components/ui/card';
import { StripeConnectButton } from '@/components/stripe-connect-button';
import { redirect } from 'next/navigation';
import { ReservationStatus } from '@prisma/client';

export default async function HostPage() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string;
  const sessionUserId = (session?.user as any)?.id as string | undefined;
  const roles = await getEffectiveRoles(sessionUserId, (session?.user as any)?.roles);
  if (!roles.includes('HOST') && !roles.includes('ADMIN')) {
    redirect('/dashboard');
  }

  const listings = await prisma.listing.findMany({
    where: { hostId: userId },
    select: { id: true, inventoryQty: true }
  });
  const reservations = await prisma.reservation.findMany({
    where: { listing: { hostId: userId }, status: ReservationStatus.CONFIRMED },
    select: { id: true, total: true, createdAt: true, checkIn: true, checkOut: true }
  });
  const connectEnabled = process.env.ENABLE_STRIPE_CONNECT === 'true';

  const now = new Date();
  const monthStarts = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
    return date;
  });

  const revenueByMonth = new Map<string, number>();
  monthStarts.forEach((date) => {
    const key = `${date.getFullYear()}-${date.getMonth()}`;
    revenueByMonth.set(key, 0);
  });

  reservations.forEach((reservation) => {
    const createdAt = new Date(reservation.createdAt);
    const key = `${createdAt.getFullYear()}-${createdAt.getMonth()}`;
    if (!revenueByMonth.has(key)) return;
    revenueByMonth.set(key, (revenueByMonth.get(key) || 0) + Number(reservation.total));
  });

  const data = monthStarts.map((date) => {
    const key = `${date.getFullYear()}-${date.getMonth()}`;
    const rawMonth = date.toLocaleDateString('es-AR', { month: 'short' }).replace('.', '');
    const label = rawMonth.charAt(0).toUpperCase() + rawMonth.slice(1);
    return {
      name: label,
      revenue: Number((revenueByMonth.get(key) || 0).toFixed(2))
    };
  });

  const hasRevenueData = data.some((item) => item.revenue > 0);

  const occupancyWindowDays = 30;
  const occupancyStart = new Date(now);
  occupancyStart.setDate(occupancyStart.getDate() - occupancyWindowDays);
  occupancyStart.setHours(0, 0, 0, 0);

  const totalInventory = listings.reduce((sum, listing) => sum + Math.max(1, listing.inventoryQty || 1), 0);
  const totalRoomNights = totalInventory * occupancyWindowDays;

  const oneDay = 24 * 60 * 60 * 1000;
  const bookedRoomNights = reservations.reduce((sum, reservation) => {
    const start = new Date(Math.max(new Date(reservation.checkIn).getTime(), occupancyStart.getTime()));
    const end = new Date(Math.min(new Date(reservation.checkOut).getTime(), now.getTime()));
    if (end <= start) return sum;
    const nights = Math.max(0, Math.ceil((end.getTime() - start.getTime()) / oneDay));
    return sum + nights;
  }, 0);

  const occupancyRate = totalRoomNights > 0 ? (bookedRoomNights / totalRoomNights) * 100 : 0;

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
          <p className="mt-2 text-3xl font-semibold text-slate-900">{occupancyRate.toFixed(0)}%</p>
          <p className="mt-1 text-xs text-slate-500">
            {reservations.length === 0 ? 'Sin reservas confirmadas' : 'Ultimos 30 dias'}
          </p>
        </Card>
      </div>

      {connectEnabled && <StripeConnectButton />}
      <HostDashboard data={data} hasData={hasRevenueData} />
    </div>
  );
}
