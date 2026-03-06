import { requireExperienceHostAccess } from '@/lib/experience-access';
import { prisma } from '@/lib/db';

export default async function HostExploreCalendarPage() {
  const { userId } = await requireExperienceHostAccess();
  const experiences = await prisma.experience.findMany({
    where: { hostId: userId },
    select: {
      id: true,
      title: true,
      scheduleText: true,
      capacity: true
    },
    orderBy: { updatedAt: 'desc' }
  });

  return (
    <div className="space-y-6">
      <div>
        <p className="section-subtitle">Explorar</p>
        <h1 className="section-title">Calendario de actividades</h1>
      </div>
      <div className="surface-card space-y-4">
        <p className="text-sm text-slate-600">
          Gestiona horarios y cupos por actividad. Puedes bloquear fechas o pausar salidas
          desde este panel.
        </p>
        <div className="grid gap-3">
          {experiences.map((experience) => (
            <div
              key={experience.id}
              className="rounded-2xl border border-slate-200/70 bg-white/70 p-4 text-sm"
            >
              <p className="font-semibold text-slate-900">{experience.title}</p>
              <p className="mt-1 text-slate-600">Horarios: {experience.scheduleText}</p>
              <p className="text-slate-600">Cupos por salida: {experience.capacity}</p>
            </div>
          ))}
          {experiences.length === 0 && (
            <p className="text-sm text-slate-500">
              Aun no hay actividades para configurar en calendario.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
