import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { redirect } from 'next/navigation';
import { HostReservations } from '@/components/host-reservations';

export default async function HostReservationsPage() {
  const session = await getServerSession(authOptions);
  const roles = (session?.user as any)?.roles || [];
  if (!roles.includes('HOST') && !roles.includes('ADMIN')) {
    redirect('/dashboard');
  }
  const userId = (session?.user as any)?.id as string;
  const reservations = await prisma.reservation.findMany({
    where: { listing: { hostId: userId } },
    include: { listing: true, user: true },
    orderBy: { createdAt: 'desc' }
  });

  const safe = reservations.map((r) => ({
    id: r.id,
    listingTitle: r.listing.title,
    guestEmail: r.user.email,
    status: r.status,
    checkIn: r.checkIn.toISOString().slice(0, 10),
    checkOut: r.checkOut.toISOString().slice(0, 10)
  }));

  return (
    <div className="space-y-8">
      <div>
        <p className="section-subtitle">Panel Host</p>
        <h1 className="section-title">Reservas del host</h1>
      </div>
      <HostReservations reservations={safe} />
    </div>
  );
}
