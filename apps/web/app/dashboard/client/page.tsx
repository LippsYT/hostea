import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { ClientReservations } from '@/components/client-reservations';

export default async function ClientPage() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string;
  const reservations = await prisma.reservation.findMany({
    where: { userId },
    include: { listing: true }
  });
  const safeReservations = reservations.map((res) => ({
    id: res.id,
    status: res.status,
    listing: { title: res.listing.title }
  }));

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
      <ClientReservations reservations={safeReservations} />
    </div>
  );
}
