import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import {
  isExperienceCompatibleWithListingZone,
  rankExperienceForListingZone
} from '@/lib/experience-matching';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const listing = await prisma.listing.findUnique({
    where: { id: params.id },
    select: { id: true, city: true, citySlug: true, neighborhood: true, zoneSlug: true, status: true }
  });

  if (!listing || listing.status !== 'ACTIVE') {
    return NextResponse.json({ experiences: [] });
  }

  const experiences = await prisma.experience.findMany({
    where: {
      status: 'ACTIVE',
      OR: [
        listing.citySlug
          ? { citySlug: listing.citySlug }
          : { city: { equals: listing.city, mode: 'insensitive' } }
      ]
    },
    include: {
      photos: { orderBy: { sortOrder: 'asc' } }
    },
    take: 30
  });

  const compatible = experiences
    .filter((experience) =>
      isExperienceCompatibleWithListingZone(experience, {
        city: listing.city,
        neighborhood: listing.neighborhood
      })
    )
    .sort((a, b) => {
      const rankA = rankExperienceForListingZone(a, {
        city: listing.city,
        neighborhood: listing.neighborhood
      });
      const rankB = rankExperienceForListingZone(b, {
        city: listing.city,
        neighborhood: listing.neighborhood
      });
      return rankB - rankA;
    })
    .slice(0, 6)
    .map((experience) => ({
      id: experience.id,
      title: experience.title,
      city: experience.city,
      zone: experience.zone,
      category: experience.category,
      coverageType: experience.coverageType,
      serviceRadiusKm: experience.serviceRadiusKm,
      pricePerPerson: Number(experience.pricePerPerson),
      photoUrl: experience.photos.find((photo) => photo.isCover)?.url || experience.photos[0]?.url || null
    }));

  return NextResponse.json({
    experiences: compatible,
    matching: {
      city: listing.city,
      neighborhood: listing.neighborhood
    }
  });
}
