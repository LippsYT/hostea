import { prisma } from '@/lib/db';
import { requireExperienceHostAccess } from '@/lib/experience-access';
import { HostExperienceList } from '@/components/host-experience-list';

const getNotice = (searchParams?: { created?: string; updated?: string; deleted?: string }) => {
  if (searchParams?.created === '1') return 'Experiencia creada correctamente.';
  if (searchParams?.updated === '1') return 'Experiencia actualizada correctamente.';
  if (searchParams?.deleted === '1') return 'Experiencia eliminada correctamente.';
  return null;
};

export default async function HostExploreActivitiesPage({
  searchParams
}: {
  searchParams?: { created?: string; updated?: string; deleted?: string };
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
  const notice = getNotice(searchParams);

  return (
    <div className="space-y-6">
      <div>
        <p className="section-subtitle">Explorar</p>
        <h1 className="section-title">Mis actividades</h1>
      </div>

      <HostExperienceList
        notice={notice}
        initial={experiences.map((experience) => ({
          id: experience.id,
          title: experience.title,
          city: experience.city,
          status: experience.status,
          capacity: experience.capacity,
          bookingsCount: experience.bookings.length,
          pricePerPerson: Number(experience.pricePerPerson),
          photoUrl: experience.photos[0]?.url ?? null
        }))}
      />
    </div>
  );
}
