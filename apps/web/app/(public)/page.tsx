import { ListingCard } from '@/components/listing-card';
import { Button } from '@/components/ui/button';
import { SearchForm } from '@/components/search-form';
import { PricePopout } from '@/components/price-popout';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function HomePage() {
  const { prisma } = await import('@/lib/db');
  const listings = await prisma.listing.findMany({
    where: { status: 'ACTIVE' },
    take: 4,
    include: { photos: { orderBy: { sortOrder: 'asc' } } },
    orderBy: { createdAt: 'desc' }
  });

  return (
    <div className="gradient-hero">
      <PricePopout />
      <section className="px-8 pb-16 pt-10">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr]">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-neutral-400">Experiencia premium 2026</p>
              <h1 className="mt-4 text-4xl font-semibold leading-tight md:text-6xl">
                Donde cada viaje empieza con confianza.
              </h1>
              <p className="mt-4 text-lg text-neutral-600">
                Descubre espacios únicos, paga seguro y conecta directo con anfitriones verificados.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button size="lg">Explorar destinos</Button>
                <Button size="lg" variant="outline">Ser anfitrión</Button>
              </div>
            </div>
            <div className="card-glass rounded-3xl p-6 shadow-soft">
              <h3 className="text-lg font-semibold">Buscar hospedaje</h3>
              <SearchForm />
            </div>
          </div>
        </div>
      </section>

      <section className="px-8 pb-20">
        <div className="mx-auto max-w-6xl">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold">Destinos destacados</h2>
            <span className="text-sm text-neutral-500">Curado por HOSTEA</span>
          </div>
          <div className="mt-6 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {listings.map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </div>
        </div>
      </section>

      <section className="px-8 pb-24">
        <div className="mx-auto max-w-6xl">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold">Legal</h2>
            <span className="text-sm text-neutral-500">Documentos importantes</span>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[
              { slug: 'terminos-condiciones', label: '📜 Términos y Condiciones' },
              { slug: 'politica-privacidad', label: '🔐 Política de Privacidad' },
              { slug: 'politica-pagos-cancelaciones', label: '💳 Política de Pagos y Cancelaciones' },
              { slug: 'terminos-anfitriones', label: '🏠 Términos para Anfitriones' },
              { slug: 'politica-reembolsos', label: '📩 Política de Reembolsos' },
              { slug: 'limitacion-responsabilidad', label: '⚖️ Limitación de Responsabilidad' }
            ].map((item) => (
              <a
                key={item.slug}
                href={`/legal/${item.slug}`}
                className="surface-card flex items-center justify-between gap-3 border border-slate-200/60 bg-white/80 px-5 py-4 text-sm font-semibold text-slate-800 transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-soft"
              >
                <span>{item.label}</span>
                <span className="text-slate-400">→</span>
              </a>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
