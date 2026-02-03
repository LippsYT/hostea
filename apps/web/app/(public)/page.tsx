import { prisma } from '@/lib/db';
import { ListingCard } from '@/components/listing-card';
import { Button } from '@/components/ui/button';
import { SearchForm } from '@/components/search-form';

export default async function HomePage() {
  const listings = await prisma.listing.findMany({
    where: { status: 'ACTIVE' },
    take: 4,
    include: { photos: true },
    orderBy: { createdAt: 'desc' }
  });

  return (
    <div className="gradient-hero">
      <section className="px-8 pb-16 pt-10">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr]">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-neutral-400">Experiencia premium 2026</p>
              <h1 className="mt-4 text-4xl font-semibold leading-tight md:text-6xl">
                HOSTEA redefine la forma de reservar hospedajes en Latam.
              </h1>
              <p className="mt-4 text-lg text-neutral-600">
                Busqueda inteligente, pagos seguros y paneles para hosts y equipos de soporte.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button size="lg">Explorar destinos</Button>
                <Button size="lg" variant="outline">Ser anfitrion</Button>
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
    </div>
  );
}
