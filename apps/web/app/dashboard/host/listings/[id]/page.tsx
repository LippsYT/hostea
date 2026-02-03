import { prisma } from '@/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { HostListingEditor } from '@/components/host-listing-editor';

export default async function HostListingEditPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const roles = (session?.user as any)?.roles || [];
  if (!roles.includes('HOST') && !roles.includes('ADMIN')) {
    redirect('/dashboard');
  }
  const userId = (session?.user as any)?.id as string;
  const listing = await prisma.listing.findUnique({
    where: { id: params.id },
    include: { photos: { orderBy: { sortOrder: 'asc' } } }
  });
  if (!listing || listing.hostId !== userId) {
    redirect('/dashboard/host/listings');
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="section-subtitle">Panel Host</p>
        <h1 className="section-title">Editar propiedad</h1>
      </div>
      <HostListingEditor
        listing={{
          id: listing.id,
          title: listing.title,
          description: listing.description,
          type: listing.type,
          address: listing.address,
          city: listing.city,
          neighborhood: listing.neighborhood,
          pricePerNight: Number(listing.pricePerNight),
          cleaningFee: Number(listing.cleaningFee),
          serviceFee: Number(listing.serviceFee),
          taxRate: Number(listing.taxRate),
          capacity: listing.capacity,
          beds: listing.beds,
          baths: listing.baths,
          cancelPolicy: listing.cancelPolicy,
          instantBook: listing.instantBook,
          photos: listing.photos.map((p) => ({ id: p.id, url: p.url, sortOrder: p.sortOrder }))
        }}
      />
    </div>
  );
}
