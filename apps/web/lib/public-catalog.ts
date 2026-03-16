import { cache } from 'react';
import { ListingType, Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { slugify } from '@/lib/slug';

export const listingPageInclude = Prisma.validator<Prisma.ListingInclude>()({
  photos: { orderBy: { sortOrder: 'asc' } },
  amenities: { include: { amenity: true } },
  host: { include: { profile: true } },
  reviews: true,
  roomTypes: true
});

export const listingCardInclude = Prisma.validator<Prisma.ListingInclude>()({
  photos: { orderBy: { sortOrder: 'asc' } }
});

export type PublicListingPage = Prisma.ListingGetPayload<{
  include: typeof listingPageInclude;
}>;

export type PublicListingCard = Prisma.ListingGetPayload<{
  include: typeof listingCardInclude;
}>;

export type CityDirectoryEntry = {
  slug: string;
  city: string;
  country: string | null;
  count: number;
  lastModified: Date;
};

export type CategoryDirectoryEntry = {
  slug: string;
  label: string;
  type: ListingType;
  count: number;
  lastModified: Date;
};

const ACTIVE_PUBLIC_STATUS = 'ACTIVE';

export const listingTypeToCategorySlug = (type: ListingType) =>
  type === 'HOTEL' ? 'hotels' : 'apartments';

export const listingTypeToCategoryLabel = (type: ListingType) =>
  type === 'HOTEL' ? 'Hoteles' : 'Apartamentos';

export const categorySlugToListingType = (slug: string): ListingType | null => {
  if (slug === 'hotels' || slug === 'hotel') return 'HOTEL';
  if (slug === 'apartments' || slug === 'apartment') return 'APARTMENT';
  return null;
};

const getDirectorySeed = cache(async () =>
  prisma.listing.findMany({
    where: { status: ACTIVE_PUBLIC_STATUS },
    select: {
      id: true,
      city: true,
      citySlug: true,
      country: true,
      type: true,
      updatedAt: true
    }
  })
);

export const getPublicListingById = cache(async (id: string) =>
  prisma.listing.findUnique({
    where: { id },
    include: listingPageInclude
  })
);

export const getCityDirectoryEntries = cache(async (): Promise<CityDirectoryEntry[]> => {
  const rows = await getDirectorySeed();
  const map = new Map<string, CityDirectoryEntry>();

  for (const row of rows) {
    const slug = row.citySlug?.trim() || slugify(row.city);
    const current = map.get(slug);
    if (!current) {
      map.set(slug, {
        slug,
        city: row.city,
        country: row.country || null,
        count: 1,
        lastModified: row.updatedAt
      });
      continue;
    }

    current.count += 1;
    if (row.updatedAt > current.lastModified) current.lastModified = row.updatedAt;
  }

  return Array.from(map.values()).sort((a, b) => a.city.localeCompare(b.city));
});

export const getCategoryDirectoryEntries = cache(async (): Promise<CategoryDirectoryEntry[]> => {
  const rows = await getDirectorySeed();
  const map = new Map<ListingType, CategoryDirectoryEntry>();

  for (const row of rows) {
    const current = map.get(row.type);
    if (!current) {
      map.set(row.type, {
        slug: listingTypeToCategorySlug(row.type),
        label: listingTypeToCategoryLabel(row.type),
        type: row.type,
        count: 1,
        lastModified: row.updatedAt
      });
      continue;
    }

    current.count += 1;
    if (row.updatedAt > current.lastModified) current.lastModified = row.updatedAt;
  }

  return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
});

export const getCityPageData = cache(async (slug: string) => {
  const entry = (await getCityDirectoryEntries()).find((item) => item.slug === slug) || null;
  if (!entry) return null;

  const listings = await prisma.listing.findMany({
    where: {
      status: ACTIVE_PUBLIC_STATUS,
      OR: [{ citySlug: slug }, { city: { equals: entry.city, mode: 'insensitive' } }]
    },
    include: listingCardInclude,
    orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }]
  });

  return { ...entry, listings };
});

export const getCategoryPageData = cache(async (categorySlug: string) => {
  const type = categorySlugToListingType(categorySlug);
  if (!type) return null;

  const entry =
    (await getCategoryDirectoryEntries()).find((item) => item.type === type) || null;
  if (!entry) return null;

  const listings = await prisma.listing.findMany({
    where: { status: ACTIVE_PUBLIC_STATUS, type },
    include: listingCardInclude,
    orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }]
  });

  return { ...entry, listings };
});

export const getSitemapListings = cache(async () =>
  prisma.listing.findMany({
    where: { status: ACTIVE_PUBLIC_STATUS },
    select: { id: true, updatedAt: true }
  })
);

