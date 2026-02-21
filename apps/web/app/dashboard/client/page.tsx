import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { ReservationStatus } from '@prisma/client';
import ClientDashboard from '../../../claude-ui/ClientDashboard';

export default async function ClientPage() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string;
  const reservations = await prisma.reservation.findMany({
    where: { userId },
    include: { listing: { include: { photos: true } } },
    orderBy: { createdAt: 'desc' }
  });

  const mappedReservations = reservations.map((res) => {
    let status: 'upcoming' | 'active' | 'completed' | 'cancelled' = 'upcoming';
    if (res.status === ReservationStatus.CHECKED_IN) status = 'active';
    if (res.status === ReservationStatus.COMPLETED) status = 'completed';
    if (
      res.status === ReservationStatus.CANCELED ||
      res.status === ReservationStatus.REFUNDED
    ) {
      status = 'cancelled';
    }

    const location = [res.listing?.neighborhood, res.listing?.city]
      .filter(Boolean)
      .join(', ');

    return {
      id: res.id,
      listingId: res.listing?.id,
      propertyName: res.listing?.title ?? 'Alojamiento',
      propertyImage: res.listing?.photos?.[0]?.url ?? null,
      location: location || 'Ubicación por definir',
      checkIn: res.checkIn.toISOString().slice(0, 10),
      checkOut: res.checkOut.toISOString().slice(0, 10),
      guests: res.guestsCount,
      status,
      totalPrice: Number(res.total)
    };
  });

  const upcomingStatuses = new Set<ReservationStatus>([
    ReservationStatus.PENDING_PAYMENT,
    ReservationStatus.CONFIRMED
  ]);
  const upcomingCount = reservations.filter((r) => upcomingStatuses.has(r.status)).length;
  const revenueStatuses = new Set<ReservationStatus>([
    ReservationStatus.CONFIRMED,
    ReservationStatus.CHECKED_IN,
    ReservationStatus.COMPLETED
  ]);
  const totalSpent = reservations
    .filter((r) => revenueStatuses.has(r.status))
    .reduce((sum, r) => sum + Number(r.total), 0);

  return (
    <ClientDashboard
      reservations={mappedReservations}
      stats={{
        totalReservations: reservations.length,
        upcomingReservations: upcomingCount,
        totalSpent
      }}
    />
  );
}
