import { prisma } from '@/lib/db';
import { ListingCard } from '@/components/listing-card';
import { checkListingAvailability } from '@/lib/listing-availability';

export default async function SearchPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const city = typeof searchParams.city === 'string' ? searchParams.city : undefined;
  const min = typeof searchParams.min === 'string' ? Number(searchParams.min) : undefined;
  const max = typeof searchParams.max === 'string' ? Number(searchParams.max) : undefined;
  const guests = typeof searchParams.guests === 'string' ? Number(searchParams.guests) : undefined;
  const checkIn = typeof searchParams.checkIn === 'string' ? searchParams.checkIn : undefined;
  const checkOut = typeof searchParams.checkOut === 'string' ? searchParams.checkOut : undefined;

  let listings = await prisma.listing.findMany({
    where: {
      city: city ? { contains: city, mode: 'insensitive' } : undefined,
      status: 'ACTIVE',
      capacity: guests ? { gte: guests } : undefined,
      pricePerNight: {
        gte: min || undefined,
        lte: max || undefined
      }
    },
    include: { photos: { orderBy: { sortOrder: 'asc' } } },
    orderBy: { createdAt: 'desc' }
  });

  if (checkIn && checkOut) {
    const from = new Date(checkIn);
    const to = new Date(checkOut);
    if (!Number.isNaN(from.getTime()) && !Number.isNaN(to.getTime()) && to > from) {
      const availability = await Promise.all(
        listings.map(async (listing) => {
          const result = await checkListingAvailability({
            listingId: listing.id,
            checkIn: from,
            checkOut: to,
            guests: Math.max(1, guests || 1)
          });
          return { listing, available: result.available };
        })
      );
      listings = availability.filter((item) => item.available).map((item) => item.listing);
    }
  }

  return (
    <div className="px-8 pb-20 pt-10">
      <div className="mx-auto max-w-6xl">
        <h1 className="text-3xl font-semibold">Resultados</h1>
        <p className="mt-2 text-sm text-neutral-500">
          {listings.length} hospedajes disponibles
          {city ? ` · ${city}` : ''}
          {guests ? ` · ${guests} huespedes` : ''}
        </p>
        <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {listings.map((listing) => (
            <ListingCard key={listing.id} listing={listing} />
          ))}
        </div>
      </div>
    </div>
  );
}
