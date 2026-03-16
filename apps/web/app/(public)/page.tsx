import Link from 'next/link';
import { Compass, Flame, Home, Sparkles, Star } from 'lucide-react';
import { ListingCard } from '@/components/listing-card';
import { PricePopout } from '@/components/price-popout';
import { SearchForm } from '@/components/search-form';
import { Button } from '@/components/ui/button';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type CurationSettings = {
  listingIds?: string[];
  experienceIds?: string[];
  destinations?: string[];
};

type DestinationCard = {
  city: string;
  country: string;
  listings: number;
  activities: number;
  cover: string | null;
};

const fallbackImage =
  'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?q=80&w=1200&auto=format&fit=crop';

const experienceShelfLabels = [
  { key: 'mostBooked', label: 'Mas reservadas', icon: Flame },
  { key: 'topRated', label: 'Mejor valoradas', icon: Star },
  { key: 'new', label: 'Nuevas actividades', icon: Sparkles },
  { key: 'trend', label: 'Tendencia de la semana', icon: Compass }
] as const;

export default async function HomePage() {
  const { prisma } = await import('@/lib/db');

  const [listings, experiences, settingsRow] = await Promise.all([
    prisma.listing.findMany({
      where: { status: 'ACTIVE' },
      take: 24,
      include: {
        photos: { orderBy: { sortOrder: 'asc' } },
        _count: { select: { reservations: true } }
      },
      orderBy: { updatedAt: 'desc' }
    }),
    prisma.experience.findMany({
      where: { status: 'ACTIVE' },
      take: 24,
      include: {
        photos: { orderBy: { sortOrder: 'asc' } },
        _count: { select: { bookings: true } }
      },
      orderBy: { updatedAt: 'desc' }
    }),
    prisma.settings.findUnique({ where: { key: 'homepage_curated' } }).catch(() => null)
  ]);

  const curation = (settingsRow?.value || {}) as CurationSettings;

  const destinationMap = new Map<string, DestinationCard>();
  for (const listing of listings) {
    const key = `${listing.city}::${listing.country || 'Sin pais'}`;
    const current = destinationMap.get(key);
    const cover = listing.photos[0]?.url || current?.cover || null;
    destinationMap.set(key, {
      city: listing.city,
      country: listing.country || 'Destino internacional',
      listings: (current?.listings || 0) + 1,
      activities: current?.activities || 0,
      cover
    });
  }
  for (const experience of experiences) {
    const listingMatch = listings.find((listing) => listing.city === experience.city);
    const key = `${experience.city}::${listingMatch?.country || 'Sin pais'}`;
    const current = destinationMap.get(key);
    const cover =
      experience.photos.find((photo) => photo.isCover)?.url ||
      experience.photos[0]?.url ||
      current?.cover ||
      null;
    destinationMap.set(key, {
      city: experience.city,
      country: current?.country || listingMatch?.country || 'Destino internacional',
      listings: current?.listings || 0,
      activities: (current?.activities || 0) + 1,
      cover
    });
  }

  const destinations = Array.from(destinationMap.values())
    .sort((a, b) => b.listings + b.activities - (a.listings + a.activities))
    .filter((item) =>
      curation.destinations?.length ? curation.destinations.includes(item.city) : true
    )
    .slice(0, 6);

  const hosteaPicks = curation.listingIds?.length
    ? listings.filter((listing) => curation.listingIds?.includes(listing.id))
    : listings.slice(0, 6);
  const topRatedListings = [...listings]
    .sort((a, b) => b._count.reservations - a._count.reservations)
    .slice(0, 6);
  const newestListings = [...listings]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 6);
  const trendingListings = [...listings]
    .sort((a, b) => {
      const aScore = a._count.reservations * 4 + a.updatedAt.getTime() / 100000000;
      const bScore = b._count.reservations * 4 + b.updatedAt.getTime() / 100000000;
      return bScore - aScore;
    })
    .slice(0, 6);

  const activityShelves = {
    mostBooked: [...experiences].sort((a, b) => b._count.bookings - a._count.bookings).slice(0, 4),
    topRated: [...experiences].sort((a, b) => b._count.bookings - a._count.bookings).slice(4, 8),
    new: [...experiences].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, 4),
    trend: [...experiences]
      .sort((a, b) => {
        const aScore = a._count.bookings * 4 + a.updatedAt.getTime() / 100000000;
        const bScore = b._count.bookings * 4 + b.updatedAt.getTime() / 100000000;
        return bScore - aScore;
      })
      .slice(0, 4)
  };

  return (
    <div className="gradient-hero w-full max-w-full overflow-x-clip">
      <PricePopout />

      <section className="px-4 pb-18 pt-10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-neutral-400">
                Plataforma viva de viajes
              </p>
              <h1 className="mt-4 text-4xl font-semibold leading-tight md:text-6xl">
                Alojamientos, actividades y soporte real en una sola experiencia.
              </h1>
              <p className="mt-5 max-w-2xl text-lg text-neutral-600">
                HOSTEA combina estadias, experiencias y conversaciones con contexto real para
                reservar con claridad y operar mejor desde ambos lados.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/search">
                  <Button size="lg">Buscar alojamientos</Button>
                </Link>
                <Link href="/explorar">
                  <Button size="lg" variant="outline">
                    Buscar actividades
                  </Button>
                </Link>
                <Link href="/host/onboarding">
                  <Button size="lg" variant="outline">
                    Publicar en HOSTEA
                  </Button>
                </Link>
              </div>
            </div>

            <div className="card-glass w-full min-w-0 rounded-[2rem] p-6 shadow-soft">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Buscador principal</p>
                  <p className="text-xs text-slate-500">
                    Alojamientos con check-in/check-out y actividades por fecha.
                  </p>
                </div>
                <span className="rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-[11px] font-semibold text-slate-600">
                  Inteligente
                </span>
              </div>
              <div className="mt-4">
                <SearchForm mode="dual" initialMode="lodging" />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 pb-10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold text-slate-900">Destinos destacados</h2>
              <p className="text-sm text-slate-500">
                Vitrina cruzada de alojamientos y actividades por ciudad.
              </p>
            </div>
            <span className="text-sm text-neutral-500">Curado por HOSTEA</span>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {destinations.map((destination) => (
              <Link
                key={`${destination.city}-${destination.country}`}
                href={`/search?city=${encodeURIComponent(destination.city)}`}
                className="group overflow-hidden rounded-3xl border border-slate-200/70 bg-white/85 shadow-soft transition hover:-translate-y-1"
              >
                <div className="relative h-44 w-full overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={destination.cover || fallbackImage}
                    alt={destination.city}
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/55 to-transparent" />
                  <div className="absolute bottom-4 left-4 right-4">
                    <p className="text-xs uppercase tracking-[0.25em] text-white/80">
                      {destination.country}
                    </p>
                    <p className="text-2xl font-semibold text-white">{destination.city}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 p-4 text-sm text-slate-600">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
                    <p className="text-xs uppercase tracking-wide text-slate-400">Alojamientos</p>
                    <p className="mt-1 font-semibold text-slate-900">{destination.listings}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
                    <p className="text-xs uppercase tracking-wide text-slate-400">Actividades</p>
                    <p className="mt-1 font-semibold text-slate-900">{destination.activities}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 pb-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl space-y-10">
          <div>
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold text-slate-900">Alojamientos destacados</h2>
                <p className="text-sm text-slate-500">
                  Mejor valorados, mas reservados, nuevos y picks manuales.
                </p>
              </div>
              <Link href="/search" className="pill-link">
                Ver todos
              </Link>
            </div>

            <div className="mt-6 space-y-8">
              {[
                { title: 'Mas reservados', items: topRatedListings },
                { title: 'Nuevos en HOSTEA', items: newestListings },
                { title: 'Tendencia', items: trendingListings },
                { title: 'Recomendados por HOSTEA', items: hosteaPicks }
              ].map((shelf) => (
                <div key={shelf.title}>
                  <div className="mb-4 flex items-center gap-2">
                    <Home className="h-4 w-4 text-slate-500" />
                    <h3 className="text-lg font-semibold text-slate-900">{shelf.title}</h3>
                  </div>
                  <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                    {shelf.items.map((listing) => (
                      <ListingCard key={listing.id} listing={listing} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold text-slate-900">Actividades destacadas</h2>
                <p className="text-sm text-slate-500">
                  Distintas vitrinas para experiencias reservables o por consulta.
                </p>
              </div>
              <Link href="/explorar" className="pill-link">
                Ver actividades
              </Link>
            </div>

            <div className="mt-6 grid gap-6 xl:grid-cols-2">
              {experienceShelfLabels.map((shelf) => {
                const Icon = shelf.icon;
                const items = activityShelves[shelf.key];
                return (
                  <article
                    key={shelf.key}
                    className="overflow-hidden rounded-3xl border border-slate-200/70 bg-white/90 p-5 shadow-soft"
                  >
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-slate-500" />
                      <h3 className="text-lg font-semibold text-slate-900">{shelf.label}</h3>
                    </div>
                    <div className="mt-4 grid gap-4">
                      {items.map((experience) => {
                        const cover =
                          experience.photos.find((photo) => photo.isCover)?.url ||
                          experience.photos[0]?.url ||
                          fallbackImage;
                        return (
                          <Link
                            key={experience.id}
                            href={`/explorar/${experience.id}`}
                            className="grid gap-4 rounded-2xl border border-slate-200 bg-slate-50/60 p-3 transition hover:border-slate-300 md:grid-cols-[120px_1fr]"
                          >
                            <div className="h-24 overflow-hidden rounded-2xl">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={cover}
                                alt={experience.title}
                                className="h-full w-full object-cover"
                              />
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-slate-900">
                                {experience.title}
                              </p>
                              <p className="mt-1 text-xs text-slate-500">
                                {experience.city}
                                {experience.zone ? ` · ${experience.zone}` : ''} · {experience.category}
                              </p>
                              <div className="mt-3 flex items-center justify-between gap-3 text-sm">
                                <span className="text-slate-500">
                                  {experience._count.bookings} reservas
                                </span>
                                <span className="font-semibold text-slate-900">
                                  USD {Number(experience.pricePerPerson).toFixed(2)}
                                </span>
                              </div>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  </article>
                );
              })}
            </div>
          </div>

        </div>
      </section>
    </div>
  );
}
