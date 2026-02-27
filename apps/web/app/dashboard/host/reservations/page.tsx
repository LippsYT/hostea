import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { redirect } from 'next/navigation';
import { HostReservations } from '@/components/host-reservations';
import { ReservationStatus } from '@prisma/client';
import {
  expireAwaitingPaymentReservations
} from '@/lib/reservation-request-flow';
import { getReservationWorkflowStatus } from '@/lib/reservation-workflow';

export default async function HostReservationsPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const session = await getServerSession(authOptions);
  const roles = (session?.user as any)?.roles || [];
  if (!roles.includes('HOST') && !roles.includes('ADMIN')) {
    redirect('/dashboard');
  }
  const userId = (session?.user as any)?.id as string;
  await expireAwaitingPaymentReservations();
  const rawView = typeof searchParams.view === 'string' ? searchParams.view : 'pending';
  const view = ['pending', 'confirmed', 'rejected'].includes(rawView) ? rawView : 'pending';
  const statusFilter =
    view === 'rejected'
      ? {
          status: {
            in: [
              ReservationStatus.REJECTED,
              ReservationStatus.EXPIRED,
              ReservationStatus.CANCELED,
              ReservationStatus.REFUNDED,
              ReservationStatus.DISPUTED
            ]
          }
        }
      : view === 'confirmed'
        ? { status: { in: [ReservationStatus.CONFIRMED, ReservationStatus.CHECKED_IN, ReservationStatus.COMPLETED] } }
        : { status: { in: [ReservationStatus.PENDING_APPROVAL, ReservationStatus.AWAITING_PAYMENT, ReservationStatus.PENDING_PAYMENT] } };
  const reservations = await prisma.reservation.findMany({
    where: { listing: { hostId: userId }, ...statusFilter },
    include: { listing: true, user: { include: { profile: true } }, payment: true },
    orderBy: { createdAt: 'desc' }
  });
  const filteredReservations =
    view === 'pending'
      ? reservations.filter((reservation) => {
          const workflow = getReservationWorkflowStatus({
            status: reservation.status,
            paymentExpiresAt: reservation.paymentExpiresAt,
            holdExpiresAt: reservation.holdExpiresAt,
            paymentStatus: reservation.payment?.status || null
          });
          return workflow === 'pending_approval' || workflow === 'awaiting_payment';
        })
      : reservations;

  const safe = filteredReservations.map((r) => ({
    id: r.id,
    listingTitle: r.listing.title,
    guestName: r.user.profile?.name || r.user.email || 'Huésped',
    guestPhone: r.user.profile?.phone || null,
    status: (() => {
      const workflow = getReservationWorkflowStatus({
        status: r.status,
        paymentExpiresAt: r.paymentExpiresAt,
        holdExpiresAt: r.holdExpiresAt,
        paymentStatus: r.payment?.status || null
      });
      if (workflow === 'pending_approval') return 'PENDING_APPROVAL';
      if (workflow === 'awaiting_payment') return 'AWAITING_PAYMENT';
      if (workflow === 'expired') return 'EXPIRED';
      if (workflow === 'rejected') return 'REJECTED';
      return r.status;
    })(),
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
          <a className={`pill-link ${view === 'pending' ? 'pill-link-active' : ''}`} href="/dashboard/host/reservations?view=pending">
            Pendientes
          </a>
          <a className={`pill-link ${view === 'confirmed' ? 'pill-link-active' : ''}`} href="/dashboard/host/reservations?view=confirmed">
            Confirmadas
          </a>
          <a className={`pill-link ${view === 'rejected' ? 'pill-link-active' : ''}`} href="/dashboard/host/reservations?view=rejected">
            Rechazadas
          </a>
        </div>
      </div>
      <HostReservations reservations={safe} />
    </div>
  );
}
