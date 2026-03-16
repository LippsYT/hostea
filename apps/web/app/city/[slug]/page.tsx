import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ListingCard } from '@/components/listing-card';
import { getCityDirectoryEntries, getCityPageData } from '@/lib/public-catalog';
import { buildCityMetadata, buildPageMetadata } from '@/lib/seo';
import { buildBreadcrumbJsonLd } from '@/lib/structured-data';
import { StructuredDataScript } from '@/components/structured-data-script';

export async function generateStaticParams() {
  const cities = await getCityDirectoryEntries();
  return cities.map((city) => ({ slug: city.slug }));
}

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const data = await getCityPageData(params.slug);
  if (!data) {
    return buildPageMetadata({
      title: 'Ciudad no disponible',
      description: 'La ciudad solicitada no tiene propiedades publicas disponibles.',
      path: `/city/${params.slug}`,
      indexable: false
    });
  }

  return buildCityMetadata(data);
}

export default async function CityPage({ params }: { params: { slug: string } }) {
  const data = await getCityPageData(params.slug);

  if (!data) notFound();

  return (
    <main className="px-4 pb-20 pt-10 sm:px-6 lg:px-8">
      <StructuredDataScript
        data={buildBreadcrumbJsonLd([
          { name: 'Inicio', path: '/' },
          { name: 'Ciudades', path: '/search' },
          { name: data.city, path: `/city/${data.slug}` }
        ])}
      />
      <div className="mx-auto max-w-6xl space-y-8">
        <section className="rounded-3xl border border-slate-200/70 bg-white/90 p-8 shadow-soft">
          <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Ciudad destacada</p>
          <h1 className="mt-4 text-4xl font-semibold text-slate-900 md:text-5xl">
            Alojamientos en {data.city}
          </h1>
          <p className="mt-4 max-w-3xl text-base text-slate-600 md:text-lg">
            Explora propiedades activas en {data.city}
            {data.country ? `, ${data.country}` : ''}. Todas las fichas muestran fotos, precios y
            disponibilidad real.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
              {data.count} propiedades
            </span>
            <Link href={`/search?city=${encodeURIComponent(data.city)}`} className="pill-link">
              Abrir busqueda
            </Link>
          </div>
        </section>

        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-2xl font-semibold text-slate-900">Propiedades activas</h2>
            <span className="text-sm text-slate-500">Actualizadas recientemente</span>
          </div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {data.listings.map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
