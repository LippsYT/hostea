import { prisma } from '@/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { HostListingForm } from '@/components/host-listing-form';
import { HostListingList } from '@/components/host-listing-list';

export default async function HostListingsPage() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string;
  const roles = (session?.user as any)?.roles || [];
  if (!roles.includes('HOST') && !roles.includes('ADMIN')) {
    redirect('/dashboard');
  }
  const listings = await prisma.listing.findMany({
    where: { hostId: userId },
    include: { photos: true },
    orderBy: { createdAt: 'desc' }
  });

  return (
    <div className="space-y-8">
      <div>
        <p className="section-subtitle">Panel Host</p>
        <h1 className="section-title">Mis propiedades</h1>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-slate-500">
          Gestiona tus anuncios y publica nuevos alojamientos.
        </div>
        <Link href="/host/onboarding" className="pill-link">
          Publicar avanzado
        </Link>
      </div>
      <HostListingForm />
      <HostListingList
        initial={listings.map((listing) => ({
          id: listing.id,
          title: listing.title,
          neighborhood: listing.neighborhood,
          status: listing.status
        }))}
      />
    </div>
  );
}
