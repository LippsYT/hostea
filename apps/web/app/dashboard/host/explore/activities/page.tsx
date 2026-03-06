import Link from 'next/link';
import { prisma } from '@/lib/db';
import { requireExperienceHostAccess } from '@/lib/experience-access';

export default async function HostExploreActivitiesPage({
  searchParams
}: {
  searchParams?: { created?: string };
}) {
  const { userId } = await requireExperienceHostAccess();
  const experiences = await prisma.experience.findMany({
    where: { hostId: userId },
    include: {
      photos: { orderBy: { sortOrder: 'asc' } },
      bookings: true
    },
    orderBy: { updatedAt: 'desc' }
  });

  return (
    <div className="space-y-6">
      <div>
        <p className="section-subtitle">Explorar</p>
        <h1 className="section-title">Mis actividades</h1>
      </div>
      <div className="surface-card space-y-3">
        {searchParams?.created === '1' && (
          <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            Experiencia creada correctamente.
          </p>
        )}
        <Link href="/dashboard/host/explore/new" className="pill-link">
          + Crear actividad
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {experiences.map((experience) => {
          const cover = experience.photos.find((photo) => photo.isCover) || experience.photos[0];
          return (
            <article
              key={experience.id}
              className="overflow-hidden rounded-3xl border border-slate-200/70 bg-white/90 shadow-soft"
            >
              {cover ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={cover.url} alt={experience.title} className="h-44 w-full object-cover" />
              ) : (
                <div className="h-44 w-full bg-slate-100" />
              )}
              <div className="space-y-3 p-4">
                <div>
                  <h2 className="line-clamp-2 text-lg font-semibold text-slate-900">{experience.title}</h2>
                  <p className="text-sm text-slate-500">{experience.city}</p>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
                    {experience.category}
                  </span>
                  <span className="font-semibold text-slate-900">
                    USD {Number(experience.pricePerPerson).toFixed(2)}
                  </span>
                </div>
                <div className="text-xs text-slate-500">
                  Capacidad: {experience.capacity} · Reservas: {experience.bookings.length}
                </div>
              </div>
            </article>
          );
        })}
        {experiences.length === 0 && (
          <div className="surface-card text-sm text-slate-500">
            Todavia no publicaste experiencias. Usa "Crear actividad" para empezar.
          </div>
        )}
      </div>
    </div>
  );
}
