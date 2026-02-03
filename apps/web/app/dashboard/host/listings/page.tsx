import { prisma } from '@/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { HostListingForm } from '@/components/host-listing-form';

export default async function HostListingsPage() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string;
  const roles = (session?.user as any)?.roles || [];
  if (!roles.includes('HOST') && !roles.includes('ADMIN')) {
    redirect('/dashboard');
  }
  const listings = await prisma.listing.findMany({ where: { hostId: userId }, include: { photos: true } });

  return (
    <div className="space-y-8">
      <div>
        <p className="section-subtitle">Panel Host</p>
        <h1 className="section-title">Mis propiedades</h1>
      </div>
      <HostListingForm />
      <div className="grid gap-3">
        {listings.map((listing) => (
          <div key={listing.id} className="surface-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-lg font-semibold text-slate-900">{listing.title}</p>
                <p className="text-sm text-slate-500">{listing.neighborhood}</p>
              </div>
              <div className="flex items-center gap-2">
                <Link href={`/dashboard/host/listings/${listing.id}`} className="pill-link">Editar</Link>
                <Link href={`/listings/${listing.id}`} className="pill-link">Ver</Link>
              </div>
            </div>
          </div>
        ))}
        {listings.length === 0 && <p className="text-sm text-slate-500">Aun no publicaste propiedades.</p>}
      </div>
    </div>
  );
}
