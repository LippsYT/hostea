import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { ClientReservations } from '@/components/client-reservations';
import { ReservationStatus } from '@prisma/client';

export default async function ClientPage() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string;
  const reservations = await prisma.reservation.findMany({
    where: { userId },
    include: { listing: { include: { photos: true } } },
    orderBy: { createdAt: 'desc' }
  });
  const safeReservations = reservations.map((res) => ({
    id: res.id,
    status: res.status,
    checkIn: res.checkIn.toISOString().slice(0, 10),
    checkOut: res.checkOut.toISOString().slice(0, 10),
    guestsCount: res.guestsCount,
    total: Number(res.total),
    listing: {
      id: res.listing.id,
      title: res.listing.title,
      photoUrl: res.listing.photos?.[0]?.url || null
    }
  }));

  const activeStatuses = new Set<ReservationStatus>([
    ReservationStatus.PENDING_PAYMENT,
    ReservationStatus.CONFIRMED,
    ReservationStatus.CHECKED_IN
  ]);
  const activeCount = reservations.filter((r) => activeStatuses.has(r.status)).length;
  const pendingCount = reservations.filter((r) => r.status === ReservationStatus.PENDING_PAYMENT).length;
  const historyCount = reservations.filter((r) => !activeStatuses.has(r.status)).length;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="section-subtitle">Panel Cliente</p>
          <h1 className="section-title">Tus reservas</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <a className="pill-link" href="/dashboard/client/messages">Mensajes</a>
          <a className="pill-link" href="/dashboard/client/profile">Perfil y KYC</a>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="stat-card">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Activas</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{activeCount}</p>
          <p className="text-xs text-slate-500">Confirmadas o en curso</p>
        </div>
        <div className="stat-card">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Pendientes de pago</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{pendingCount}</p>
          <p className="text-xs text-slate-500">Requieren completar pago</p>
        </div>
        <div className="stat-card">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Historial</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{historyCount}</p>
          <p className="text-xs text-slate-500">Completadas o canceladas</p>
        </div>
      </div>
      <ClientReservations reservations={safeReservations} />
    </div>
  );
}
