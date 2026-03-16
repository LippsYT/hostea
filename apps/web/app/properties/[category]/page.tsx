import { notFound } from 'next/navigation';
import { ListingCard } from '@/components/listing-card';
import {
  getCategoryDirectoryEntries,
  getCategoryPageData
} from '@/lib/public-catalog';
import { buildCategoryMetadata, buildPageMetadata } from '@/lib/seo';
import { buildBreadcrumbJsonLd } from '@/lib/structured-data';
import { StructuredDataScript } from '@/components/structured-data-script';

export async function generateStaticParams() {
  const categories = await getCategoryDirectoryEntries();
  return categories.map((category) => ({ category: category.slug }));
}

export async function generateMetadata({ params }: { params: { category: string } }) {
  const data = await getCategoryPageData(params.category);
  if (!data) {
    return buildPageMetadata({
      title: 'Categoria no disponible',
      description: 'La categoria solicitada no tiene propiedades publicas disponibles.',
      path: `/properties/${params.category}`,
      indexable: false
    });
  }

  return buildCategoryMetadata(data);
}

export default async function PropertyCategoryPage({
  params
}: {
  params: { category: string };
}) {
  const data = await getCategoryPageData(params.category);

  if (!data) notFound();

  return (
    <main className="px-4 pb-20 pt-10 sm:px-6 lg:px-8">
      <StructuredDataScript
        data={buildBreadcrumbJsonLd([
          { name: 'Inicio', path: '/' },
          { name: 'Propiedades', path: '/search' },
          { name: data.label, path: `/properties/${data.slug}` }
        ])}
      />
      <div className="mx-auto max-w-6xl space-y-8">
        <section className="rounded-3xl border border-slate-200/70 bg-white/90 p-8 shadow-soft">
          <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Categoria publica</p>
          <h1 className="mt-4 text-4xl font-semibold text-slate-900 md:text-5xl">{data.label}</h1>
          <p className="mt-4 max-w-3xl text-base text-slate-600 md:text-lg">
            Descubre {data.count} {data.label.toLowerCase()} activos en Hostea con fotos,
            ubicaciones verificadas, precios y disponibilidad real.
          </p>
        </section>

        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-2xl font-semibold text-slate-900">Resultados</h2>
            <span className="text-sm text-slate-500">{data.count} propiedades</span>
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
