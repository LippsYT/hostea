import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { Button } from '@/components/ui/button';

export default async function ExploreDetailPage({ params }: { params: { id: string } }) {
  const experience = await prisma.experience.findUnique({
    where: { id: params.id },
    include: {
      photos: { orderBy: { sortOrder: 'asc' } },
      host: { include: { profile: true } }
    }
  });

  if (!experience || experience.status !== 'ACTIVE') {
    notFound();
  }

  const cover = experience.photos.find((photo) => photo.isCover) || experience.photos[0] || null;
  const gallery = cover
    ? [cover, ...experience.photos.filter((photo) => photo.id !== cover.id)]
    : experience.photos;

  return (
    <main className="px-4 pb-20 pt-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-500">{experience.city}</p>
            <h1 className="text-3xl font-semibold text-slate-900">{experience.title}</h1>
          </div>
          <Link href="/explorar" className="pill-link">
            Volver a experiencias
          </Link>
        </div>

        <section className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
          <div className="space-y-6">
            {gallery.length > 0 ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {gallery.map((photo) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={photo.id}
                    src={photo.url}
                    alt={experience.title}
                    className="h-60 w-full rounded-3xl object-cover"
                  />
                ))}
              </div>
            ) : (
              <div className="h-72 rounded-3xl bg-slate-100" />
            )}

            <article className="surface-card">
              <h2 className="text-xl font-semibold text-slate-900">Descripcion</h2>
              <p className="mt-3 whitespace-pre-wrap text-sm text-slate-600">{experience.description}</p>
            </article>
          </div>

          <aside className="surface-card space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-slate-500">Precio por persona</p>
                <p className="text-3xl font-semibold text-slate-900">
                  USD {Number(experience.pricePerPerson).toFixed(2)}
                </p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                {experience.category}
              </span>
            </div>
            <div className="space-y-2 text-sm text-slate-600">
              <p>Duracion: {experience.durationMinutes} min</p>
              <p>Idioma: {experience.language}</p>
              <p>Cupos por salida: {experience.capacity}</p>
              <p>Punto de encuentro: {experience.meetingPoint}</p>
              <p>Horarios: {experience.scheduleText}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-3 text-sm text-slate-600">
              Anfitrion: {experience.host.profile?.name || experience.host.email}
            </div>
            <Button className="w-full">Reservar actividad</Button>
          </aside>
        </section>
      </div>
    </main>
  );
}
