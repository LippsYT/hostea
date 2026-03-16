import { ListingCard } from '@/components/listing-card';
import { SearchForm } from '@/components/search-form';
import { prisma } from '@/lib/db';
import { checkListingAvailability } from '@/lib/listing-availability';
import { buildOccupancySummary } from '@/lib/occupancy';
import { buildPageMetadata } from '@/lib/seo';

const parseCount = (value: string | string[] | undefined, fallback: number) => {
  const raw = typeof value === 'string' ? Number(value) : Number.NaN;
  return Number.isFinite(raw) ? Math.max(0, raw) : fallback;
};

export async function generateMetadata({
  searchParams
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const city = typeof searchParams.city === 'string' ? searchParams.city : '';
  const hasFilters = Object.values(searchParams).some((value) =>
    Array.isArray(value) ? value.length > 0 : Boolean(value)
  );

  return buildPageMetadata({
    title: city ? `Alojamientos en ${city}` : 'Alojamientos',
    description: city
      ? `Busca alojamientos en ${city} con check-in, check-out y ocupacion real en Hostea.`
      : 'Explora alojamientos en Hostea con disponibilidad real, fotos, precios y reservas.',
    path: '/search',
    keywords: [city, 'busqueda de alojamientos', 'propiedades'].filter(Boolean),
    indexable: !hasFilters
  });
}

export default async function SearchPage({
  searchParams
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const city = typeof searchParams.city === 'string' ? searchParams.city : undefined;
  const min = typeof searchParams.min === 'string' ? Number(searchParams.min) : undefined;
  const max = typeof searchParams.max === 'string' ? Number(searchParams.max) : undefined;
  const adults = Math.max(1, parseCount(searchParams.adults, parseCount(searchParams.guests, 2)));
  const children = parseCount(searchParams.children, 0);
  const infants = parseCount(searchParams.infants, 0);
  const guests = Math.max(1, adults + children + infants);
  const checkIn = typeof searchParams.checkIn === 'string' ? searchParams.checkIn : undefined;
  const checkOut = typeof searchParams.checkOut === 'string' ? searchParams.checkOut : undefined;

  let listings = await prisma.listing.findMany({
    where: {
      OR: city
        ? [
            { city: { contains: city, mode: 'insensitive' } },
            { neighborhood: { contains: city, mode: 'insensitive' } },
            { address: { contains: city, mode: 'insensitive' } }
          ]
        : undefined,
      status: 'ACTIVE',
      capacity: { gte: guests },
      pricePerNight: {
        gte: min || undefined,
        lte: max || undefined
      }
    },
    include: {
      photos: { orderBy: { sortOrder: 'asc' } },
      _count: { select: { reservations: true } }
    },
    orderBy: [{ instantBook: 'desc' }, { updatedAt: 'desc' }]
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
            guests
          });
          return { listing, available: result.available };
        })
      );
      listings = availability.filter((item) => item.available).map((item) => item.listing);
    }
  }

  return (
    <main className="px-4 pb-20 pt-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-8">
        <section className="rounded-3xl border border-slate-200/70 bg-white/90 p-6 shadow-soft">
          <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-slate-500">
                Busqueda de alojamientos
              </p>
              <h1 className="mt-3 text-3xl font-semibold text-slate-900 md:text-4xl">
                Resultados con check-in, check-out y ocupacion detallada
              </h1>
              <p className="mt-3 max-w-2xl text-sm text-slate-600">
                La capacidad se calcula con adultos, ninos e infantes, y el resultado respeta la
                disponibilidad real del calendario.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                  {listings.length} hospedajes
                </span>
                {city ? (
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                    {city}
                  </span>
                ) : null}
                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                  {buildOccupancySummary({ adults, children, infants })}
                </span>
              </div>
            </div>
            <div className="rounded-[2rem] border border-slate-200 bg-slate-50/70 p-4">
              <SearchForm
                mode="lodging"
                initialValues={{ city, checkIn, checkOut, adults, children, infants }}
                compact
              />
            </div>
          </div>
        </section>

        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-2xl font-semibold text-slate-900">Resultados</h2>
            <span className="text-sm text-slate-500">Ordenados por disponibilidad y actualidad</span>
          </div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {listings.map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </div>
          {listings.length === 0 ? (
            <div className="surface-card mt-6 text-sm text-slate-500">
              No hay alojamientos para esos filtros. Cambia fechas, destino o distribucion de
              viajeros.
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}
