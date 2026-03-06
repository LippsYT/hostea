import Link from 'next/link';
import { prisma } from '@/lib/db';
import { Button } from '@/components/ui/button';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type ExploreSearchParams = {
  q?: string;
  city?: string;
  category?: string;
};

export default async function ExplorePage({
  searchParams
}: {
  searchParams?: ExploreSearchParams;
}) {
  const q = searchParams?.q?.trim() || '';
  const city = searchParams?.city?.trim() || '';
  const category = searchParams?.category?.trim() || '';

  const where = {
    status: 'ACTIVE',
    ...(q
      ? {
          OR: [
            { title: { contains: q, mode: 'insensitive' as const } },
            { description: { contains: q, mode: 'insensitive' as const } }
          ]
        }
      : {}),
    ...(city ? { city: { equals: city, mode: 'insensitive' as const } } : {}),
    ...(category ? { category: { equals: category, mode: 'insensitive' as const } } : {})
  };

  const [experiences, cities, categories] = await Promise.all([
    prisma.experience.findMany({
      where,
      include: {
        photos: { orderBy: { sortOrder: 'asc' } }
      },
      orderBy: { updatedAt: 'desc' },
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
          <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Marketplace global</p>
          <h1 className="mt-4 text-4xl font-semibold leading-tight text-slate-900 md:text-5xl">
            Explorar experiencias en cualquier ciudad
          </h1>
          <p className="mt-4 max-w-3xl text-base text-slate-600 md:text-lg">
            HOSTEA conecta viajeros con tours, paseos, excursiones y actividades culturales
            creadas por anfitriones locales.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/dashboard/host/explore/new">
              <Button size="lg">Publicar mi experiencia</Button>
            </Link>
            <a href="#catalogo">
              <Button size="lg" variant="outline">
                Ver experiencias
              </Button>
            </a>
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
              Filtrar
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
                    <Link href={`/explorar/${experience.id}`}>
                      <h3 className="line-clamp-2 text-base font-semibold text-slate-900">
                        {experience.title}
                      </h3>
                    </Link>
                    <p className="text-sm text-slate-500">{experience.city}</p>
                    <p className="text-xs text-slate-500">
                      {experience.category} · {experience.durationMinutes} min
                    </p>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-slate-900">
                        USD {Number(experience.pricePerPerson).toFixed(2)}
                      </span>
                      <Link href={`/explorar/${experience.id}`} className="pill-link">
                        Reservar
                      </Link>
                    </div>
                  </div>
                </article>
              );
            })}
            {experiences.length === 0 && (
              <div className="surface-card text-sm text-slate-500">
                No hay experiencias con esos filtros. Prueba con otra ciudad o categoria.
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
