import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { requireExperienceHostAccess } from '@/lib/experience-access';
import { ExperienceForm } from '@/components/experience-form';

export default async function HostExploreEditActivityPage({
  params
}: {
  params: { id: string };
}) {
  const { userId, roles } = await requireExperienceHostAccess();
  const experience = await prisma.experience.findFirst({
    where: roles.includes('ADMIN') ? { id: params.id } : { id: params.id, hostId: userId },
    include: { photos: { orderBy: { sortOrder: 'asc' } } }
  });

  if (!experience) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="section-subtitle">Explorar</p>
        <h1 className="section-title">Editar actividad</h1>
      </div>

      <ExperienceForm
        mode="edit"
        experienceId={experience.id}
        initialData={{
          title: experience.title,
          description: experience.description,
          category: experience.category,
          city: experience.city,
          meetingPoint: experience.meetingPoint,
          durationMinutes: experience.durationMinutes,
          language: experience.language,
          pricePerPerson: Number(experience.pricePerPerson),
          childPrice: Number(experience.childPrice ?? 0),
          infantPrice: Number(experience.infantPrice ?? 0),
          capacity: experience.capacity,
          activityType: experience.activityType,
          includesText: experience.includesText,
          excludesText: experience.excludesText,
          requirementsText: experience.requirementsText,
          schedules: experience.scheduleText
            .split('|')
            .map((slot) => slot.trim())
            .filter(Boolean),
          photos: experience.photos.map((photo) => ({
            id: photo.id,
            url: photo.url,
            isCover: photo.isCover,
            sortOrder: photo.sortOrder
          }))
        }}
      />
    </div>
  );
}
