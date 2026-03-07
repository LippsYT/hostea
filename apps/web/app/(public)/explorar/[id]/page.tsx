import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { ExperienceBookingForm } from '@/components/experience-booking-form';

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
  const schedules = experience.scheduleText
    .split('|')
    .map((item) => item.trim())
    .filter(Boolean);

  return (
    <main className="px-4 pb-20 pt-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-8">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm text-slate-500">{experience.city}</p>
            <h1 className="text-3xl font-semibold text-slate-900">{experience.title}</h1>
          </div>
          <Link href="/explorar" className="pill-link">
            Volver a experiencias
          </Link>
        </div>

        <section className="grid gap-4 lg:grid-cols-[2fr_1fr]">
          <div className="space-y-4 lg:col-start-1">
            {cover ? (
              <div className="grid gap-4 md:grid-cols-[2fr_1fr]">
                <div className="relative h-64 overflow-hidden rounded-3xl md:h-80">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={cover.url} alt={experience.title} className="h-full w-full object-cover" />
                </div>
                <div className="grid gap-4">
                  {gallery
                    .filter((photo) => photo.id !== cover.id)
                    .slice(0, 3)
                    .map((photo) => (
                      <div key={photo.id} className="relative h-24 overflow-hidden rounded-3xl md:h-[100px]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={photo.url} alt={experience.title} className="h-full w-full object-cover" />
                      </div>
                    ))}
                </div>
              </div>
            ) : (
              <div className="h-72 rounded-3xl bg-slate-100" />
            )}

            <article className="surface-card">
              <h2 className="text-xl font-semibold text-slate-900">Descripcion</h2>
              <p className="mt-3 whitespace-pre-wrap text-sm text-slate-600">{experience.description}</p>
            </article>

            <div className="grid gap-4 md:grid-cols-2">
              <article className="surface-card">
                <h3 className="text-base font-semibold text-slate-900">Detalles</h3>
                <div className="mt-3 space-y-2 text-sm text-slate-600">
                  <p>Categoria: {experience.category}</p>
                  <p>Ciudad: {experience.city}</p>
                  {experience.zone && <p>Zona: {experience.zone}</p>}
                  <p>Duracion: {experience.durationMinutes} min</p>
                  <p>Idioma: {experience.language}</p>
                  <p>Cupos por salida: {experience.capacity}</p>
                  <p>Punto de encuentro: {experience.meetingPoint}</p>
                  <p>
                    Cobertura:{' '}
                    {experience.coverageType === 'PICKUP' ? 'Recogida / traslado' : 'Punto fijo'}
                  </p>
                  {experience.coverageType === 'PICKUP' && (
                    <>
                      {experience.serviceRadiusKm && (
                        <p>Radio de cobertura: {experience.serviceRadiusKm} km</p>
                      )}
                      {experience.coveredZones && <p>Zonas cubiertas: {experience.coveredZones}</p>}
                    </>
                  )}
                  <p>Horarios: {experience.scheduleText}</p>
                </div>
              </article>
              <article className="surface-card">
                <h3 className="text-base font-semibold text-slate-900">Precios por pasajero</h3>
                <div className="mt-3 space-y-2 text-sm text-slate-600">
                  <p>Adulto: USD {Number(experience.pricePerPerson).toFixed(2)}</p>
                  <p>
                    Nino: USD{' '}
                    {Number(experience.childPrice ?? experience.pricePerPerson).toFixed(2)}
                  </p>
                  <p>Infante: USD {Number(experience.infantPrice ?? 0).toFixed(2)}</p>
                </div>
              </article>
            </div>

            {(experience.includesText || experience.excludesText || experience.requirementsText) && (
              <article className="surface-card space-y-3">
                {experience.includesText && (
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">Incluye</h3>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">
                      {experience.includesText}
                    </p>
                  </div>
                )}
                {experience.excludesText && (
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">No incluye</h3>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">
                      {experience.excludesText}
                    </p>
                  </div>
                )}
                {experience.requirementsText && (
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">Requisitos</h3>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">
                      {experience.requirementsText}
                    </p>
                  </div>
                )}
              </article>
            )}
          </div>

          <aside className="h-fit lg:sticky lg:top-24 lg:row-span-2 lg:col-start-2">
            <div className="surface-card">
              <div className="rounded-2xl border border-slate-200/70 bg-slate-50/80 px-4 py-3">
                <p className="text-sm font-semibold text-slate-900">Cotiza tu experiencia</p>
                <p className="mt-1 text-xs text-slate-500">
                  Selecciona fechas y participantes para ver el total estimado.
                </p>
              </div>

              <div className="mt-4 flex items-start justify-between">
                <div>
                  <p className="text-sm text-slate-500">Desde</p>
                  <p className="text-3xl font-semibold text-slate-900">
                    USD {Number(experience.pricePerPerson).toFixed(2)}
                  </p>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                  {experience.category}
                </span>
              </div>

              <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-3 text-sm text-slate-600">
                Anfitrion: {experience.host.profile?.name || experience.host.email}
              </div>

              <div className="mt-4">
                <ExperienceBookingForm
                  experienceId={experience.id}
                  activityType={experience.activityType}
                  adultPrice={Number(experience.pricePerPerson)}
                  childPrice={Number(experience.childPrice ?? experience.pricePerPerson)}
                  infantPrice={Number(experience.infantPrice ?? 0)}
                  capacity={experience.capacity}
                  schedules={schedules.length ? schedules : ['A coordinar con el anfitrion']}
                />
              </div>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}
