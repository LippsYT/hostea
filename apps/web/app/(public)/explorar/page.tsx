import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { SearchForm } from '@/components/search-form';
import { prisma } from '@/lib/db';
import { buildOccupancySummary } from '@/lib/occupancy';
import { buildPageMetadata } from '@/lib/seo';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type ExploreSearchParams = {
  q?: string;
  city?: string;
  category?: string;
  date?: string;
  adults?: string;
  children?: string;
  infants?: string;
  guests?: string;
};

const parseCount = (value: string | undefined, fallback: number) => {
  const raw = Number(value);
  return Number.isFinite(raw) ? Math.max(0, raw) : fallback;
};

export async function generateMetadata({
  searchParams
}: {
  searchParams?: ExploreSearchParams;
}) {
  const hasFilters = Boolean(
    searchParams?.q ||
      searchParams?.city ||
      searchParams?.category ||
      searchParams?.date ||
      searchParams?.adults ||
      searchParams?.children ||
      searchParams?.infants ||
      searchParams?.guests
  );

  return buildPageMetadata({
    title: 'Actividades',
    description:
      'Explora actividades, tours, shows y experiencias en Hostea con fecha y participantes reales.',
    path: '/explorar',
    keywords: ['actividades', 'experiencias', 'tours', 'shows'],
    indexable: !hasFilters
  });
}

export default async function ExplorePage({
  searchParams
}: {
  searchParams?: ExploreSearchParams;
}) {
  const q = searchParams?.q?.trim() || '';
  const city = searchParams?.city?.trim() || '';
  const category = searchParams?.category?.trim() || '';
  const date = searchParams?.date?.trim() || '';
  const adults = Math.max(1, parseCount(searchParams?.adults, parseCount(searchParams?.guests, 2)));
  const children = parseCount(searchParams?.children, 0);
  const infants = parseCount(searchParams?.infants, 0);
  const totalGuests = adults + children + infants;

  const filters = [
    { status: 'ACTIVE' as const },
    { capacity: { gte: totalGuests } },
    ...(q
      ? [
          {
            OR: [
              { title: { contains: q, mode: 'insensitive' as const } },
              { description: { contains: q, mode: 'insensitive' as const } },
              { category: { contains: q, mode: 'insensitive' as const } }
            ]
          }
        ]
      : []),
    ...(city
      ? [
          {
            OR: [
              { city: { contains: city, mode: 'insensitive' as const } },
              { zone: { contains: city, mode: 'insensitive' as const } }
            ]
          }
        ]
      : []),
    ...(category
      ? [{ category: { equals: category, mode: 'insensitive' as const } }]
      : [])
  ];
  const where = { AND: filters };

  const [experiences, cities, categories] = await Promise.all([
    prisma.experience.findMany({
      where,
      include: {
        photos: { orderBy: { sortOrder: 'asc' } },
        _count: { select: { bookings: true } }
      },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
      take: 60
    }),
    prisma.experience.findMany({
      where: { status: 'ACTIVE' },
      distinct: ['city'],
      select: { city: true },
      orderBy: { city: 'asc' }
    }),
    prisma.experience.findMany({
      where: { status: 'ACTIVE' },
      distinct: ['category'],
      select: { category: true },
      orderBy: { category: 'asc' }
    })
  ]);

  const cityOptions = cities.map((row) => row.city);
  const categoryOptions = categories.map((row) => row.category);

  return (
    <main className="px-4 pb-20 pt-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-8">
        <section className="rounded-3xl border border-slate-200/70 bg-white/85 p-8 shadow-soft backdrop-blur">
          <div className="grid gap-8 lg:grid-cols-[1fr_420px]">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Marketplace global</p>
              <h1 className="mt-4 text-4xl font-semibold leading-tight text-slate-900 md:text-5xl">
                Explorar actividades con fecha y participantes reales
              </h1>
              <p className="mt-4 max-w-3xl text-base text-slate-600 md:text-lg">
                HOSTEA conecta viajeros con tours, shows, paseos y experiencias creadas por
                anfitriones locales, sin mezclar la logica de alojamientos.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link href="/dashboard/host/explore/new">
                  <Button size="lg">Publicar mi actividad</Button>
                </Link>
                <a href="#catalogo">
                  <Button size="lg" variant="outline">
                    Ver catalogo
                  </Button>
                </a>
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                {city ? (
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                    {city}
                  </span>
                ) : null}
                {date ? (
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                    {date}
                  </span>
                ) : null}
                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                  {buildOccupancySummary({ adults, children, infants })}
                </span>
              </div>
            </div>
            <div className="rounded-[2rem] border border-slate-200 bg-slate-50/70 p-4">
              <SearchForm
                mode="activity"
                initialValues={{ city, date, adults, children, infants }}
                compact
              />
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200/70 bg-white/85 p-5 shadow-soft">
          <form className="grid gap-3 md:grid-cols-4" action="/explorar" method="get">
            <input
              name="q"
              defaultValue={q}
              placeholder="Buscar actividad"
              className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm"
            />
            <select
              name="city"
              defaultValue={city}
              className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm"
            >
              <option value="">Todas las ciudades</option>
              {cityOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <select
              name="category"
              defaultValue={category}
              className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm"
            >
              <option value="">Todas las categorias</option>
              {categoryOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <Button className="h-11" type="submit">
              Filtrar catalogo
            </Button>
          </form>
        </section>

        <section id="catalogo">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-2xl font-semibold text-slate-900">Catalogo de experiencias</h2>
            <span className="text-sm text-slate-500">{experiences.length} resultados</span>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {experiences.map((experience) => {
              const cover =
                experience.photos.find((photo) => photo.isCover) || experience.photos[0] || null;
              return (
                <article
                  key={experience.id}
                  className="overflow-hidden rounded-3xl border border-slate-200/70 bg-white/90 shadow-soft"
                >
                  <Link href={`/explorar/${experience.id}`}>
                    {cover ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={cover.url}
                        alt={experience.title}
                        className="h-44 w-full object-cover"
                      />
                    ) : (
                      <div className="h-44 w-full bg-slate-100" />
                    )}
                  </Link>
                  <div className="space-y-2 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <Link href={`/explorar/${experience.id}`}>
                        <h3 className="line-clamp-2 text-base font-semibold text-slate-900">
                          {experience.title}
                        </h3>
                      </Link>
                      <span className="rounded-full border border-slate-200 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
                        {experience.category}
                      </span>
                    </div>
                    <p className="text-sm text-slate-500">
                      {experience.city}
                      {experience.zone ? ` · ${experience.zone}` : ''}
                    </p>
                    <p className="text-xs text-slate-500">
                      {experience.durationMinutes} min · {experience._count.bookings} reservas
                    </p>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-slate-900">
                        USD {Number(experience.pricePerPerson).toFixed(2)}
                      </span>
                      <Link href={`/explorar/${experience.id}`} className="pill-link">
                        Ver detalle
                      </Link>
                    </div>
                  </div>
                </article>
              );
            })}
            {experiences.length === 0 && (
              <div className="surface-card text-sm text-slate-500">
                No hay actividades con esos filtros. Cambia ciudad, categoria o cantidad de
                participantes.
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
