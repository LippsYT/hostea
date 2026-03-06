import Image from 'next/image';
import Link from 'next/link';
import { Badge } from './ui/badge';
import type { Listing, ListingPhoto } from '@prisma/client';

type ListingWithPhotos = Listing & { photos: ListingPhoto[] };

export const ListingCard = ({ listing }: { listing: ListingWithPhotos }) => {
  const coverPhoto = [...(listing.photos || [])]
    .sort((a, b) => a.sortOrder - b.sortOrder)[0];
  const photo = coverPhoto?.url || 'https://images.unsplash.com/photo-1505691938895-1758d7feb511?q=80&w=1200&auto=format&fit=crop';
  return (
    <Link href={`/listings/${listing.id}`} className="group h-full">
      <article className="flex h-full flex-col overflow-hidden rounded-3xl border border-neutral-100 bg-white shadow-soft transition hover:-translate-y-1">
        <div className="relative h-52 w-full shrink-0">
          <Image src={photo} alt={listing.title} fill className="object-cover" />
        </div>
        <div className="flex flex-1 flex-col p-5">
          <div className="flex items-center justify-between">
            <h3
              className="pr-2 text-lg font-semibold leading-6"
              style={{
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden'
              }}
            >
              {listing.title}
            </h3>
            {listing.instantBook && <Badge>Instant</Badge>}
          </div>
          <p className="mt-2 min-h-[20px] text-sm text-neutral-500">
            {listing.neighborhood}, {listing.city}
          </p>
          <div className="mt-auto flex items-center justify-between pt-4 text-sm">
            <span className="font-medium">USD {Number(listing.pricePerNight).toFixed(0)} / noche</span>
            <span className="text-neutral-400">Rating 4.8</span>
          </div>
        </div>
      </article>
    </Link>
  );
};
