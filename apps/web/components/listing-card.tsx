import Image from 'next/image';
import Link from 'next/link';
import { Badge } from './ui/badge';
import type { Listing, ListingPhoto } from '@prisma/client';

type ListingWithPhotos = Listing & { photos: ListingPhoto[] };

export const ListingCard = ({ listing }: { listing: ListingWithPhotos }) => {
  const photo = listing.photos[0]?.url || 'https://images.unsplash.com/photo-1505691938895-1758d7feb511?q=80&w=1200&auto=format&fit=crop';
  return (
    <Link href={`/listings/${listing.id}`} className="group">
      <div className="overflow-hidden rounded-3xl border border-neutral-100 bg-white shadow-soft transition hover:-translate-y-1">
        <div className="relative h-52 w-full">
          <Image src={photo} alt={listing.title} fill className="object-cover" />
        </div>
        <div className="p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">{listing.title}</h3>
            {listing.instantBook && <Badge>Instant</Badge>}
          </div>
          <p className="mt-2 text-sm text-neutral-500">{listing.neighborhood}, {listing.city}</p>
          <div className="mt-4 flex items-center justify-between text-sm">
            <span className="font-medium">USD {Number(listing.pricePerNight).toFixed(0)} / noche</span>
            <span className="text-neutral-400">Rating 4.8</span>
          </div>
        </div>
      </div>
    </Link>
  );
};
