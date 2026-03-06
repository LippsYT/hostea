import { requireExperienceHostAccess } from '@/lib/experience-access';
import { ExperienceForm } from '@/components/experience-form';

export default async function HostExploreNewPage() {
  await requireExperienceHostAccess();

  return (
    <div className="space-y-6">
      <div>
        <p className="section-subtitle">Explorar</p>
        <h1 className="section-title">Crear actividad</h1>
      </div>

      <ExperienceForm />
    </div>
  );
}
