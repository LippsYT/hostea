import { prisma } from '@/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getEffectiveRoles } from '@/lib/server-roles';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { HostListingList } from '@/components/host-listing-list';

const getNotice = (searchParams: Record<string, string | string[] | undefined>) => {
  if (searchParams.created === '1') return 'La propiedad se creo correctamente.';
  if (searchParams.updated === '1') return 'La propiedad se actualizo correctamente.';
  if (searchParams.deleted === '1') return 'La propiedad se elimino correctamente.';
  return null;
};

export default async function HostListingsPage({
  searchParams
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string;
  const sessionUserId = (session?.user as any)?.id as string | undefined;
  const roles = await getEffectiveRoles(sessionUserId, (session?.user as any)?.roles);
  if (!roles.includes('HOST') && !roles.includes('ADMIN')) {
    redirect('/dashboard');
  }
  const listings = await prisma.listing.findMany({
    where: { hostId: userId },
    include: { photos: { orderBy: { sortOrder: 'asc' } } },
    orderBy: { updatedAt: 'desc' }
  });
  const notice = getNotice(searchParams);

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
      <HostListingList
        notice={notice}
        initial={listings.map((listing) => ({
          id: listing.id,
          title: listing.title,
          city: listing.city,
          neighborhood: listing.neighborhood,
          status: listing.status,
          photoUrl: listing.photos[0]?.url ?? null
        }))}
      />
    </div>
  );
}
