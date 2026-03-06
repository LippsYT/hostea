import { requireExperienceHostAccess } from '@/lib/experience-access';

export default async function HostExploreStatsPage() {
  await requireExperienceHostAccess();

  return (
    <div className="space-y-6">
      <div>
        <p className="section-subtitle">Explorar</p>
        <h1 className="section-title">Estadisticas</h1>
      </div>
      <div className="surface-card text-sm text-slate-600">
        Visualiza conversion, ingresos y rendimiento por actividad.
      </div>
    </div>
  );
}
