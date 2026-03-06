import { requireExperienceHostAccess } from '@/lib/experience-access';

export default async function HostExploreReviewsPage() {
  await requireExperienceHostAccess();

  return (
    <div className="space-y-6">
      <div>
        <p className="section-subtitle">Explorar</p>
        <h1 className="section-title">Resenas</h1>
      </div>
      <div className="surface-card text-sm text-slate-600">
        Seguimiento de reseñas y puntuaciones para tus actividades.
      </div>
    </div>
  );
}
