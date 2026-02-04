import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { redirect } from 'next/navigation';
import { HostReservations } from '@/components/host-reservations';
import { ReservationStatus } from '@prisma/client';

export default async function HostReservationsPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const session = await getServerSession(authOptions);
  const roles = (session?.user as any)?.roles || [];
  if (!roles.includes('HOST') && !roles.includes('ADMIN')) {
    redirect('/dashboard');
  }
  const userId = (session?.user as any)?.id as string;
  const view = typeof searchParams.view === 'string' ? searchParams.view : 'active';
  const historyStatuses: ReservationStatus[] = [
    ReservationStatus.CANCELED,
    ReservationStatus.REFUNDED,
    ReservationStatus.DISPUTED,
    ReservationStatus.COMPLETED
  ];
  const statusFilter =
    view === 'history'
      ? { status: { in: historyStatuses } }
      : { status: ReservationStatus.CONFIRMED };
  const reservations = await prisma.reservation.findMany({
    where: { listing: { hostId: userId }, ...statusFilter },
    include: { listing: true, user: { include: { profile: true } } },
    orderBy: { createdAt: 'desc' }
  });

  const safe = reservations.map((r) => ({
    id: r.id,
    listingTitle: r.listing.title,
    guestName: r.user.profile?.name || r.user.email || 'Huésped',
    guestPhone: r.user.profile?.phone || null,
    status: r.status,
    checkIn: r.checkIn.toISOString().slice(0, 10),
    checkOut: r.checkOut.toISOString().slice(0, 10),
    total: Number(r.total)
  }));

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="section-subtitle">Panel Host</p>
          <h1 className="section-title">Reservas</h1>
        </div>
        <div className="flex gap-2">
          <a className={`pill-link ${view !== 'history' ? 'pill-link-active' : ''}`} href="/dashboard/host/reservations">
            Confirmadas
          </a>
          <a className={`pill-link ${view === 'history' ? 'pill-link-active' : ''}`} href="/dashboard/host/reservations?view=history">
            Historial
          </a>
        </div>
      </div>
      <HostReservations reservations={safe} />
    </div>
  );
}
