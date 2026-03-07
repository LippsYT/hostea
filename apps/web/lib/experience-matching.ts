export type ListingZoneContext = {
  city: string | null | undefined;
  neighborhood: string | null | undefined;
};

export type ExperienceZoneContext = {
  city: string;
  zone?: string | null;
  coverageType?: 'FIXED' | 'PICKUP' | string | null;
  serviceRadiusKm?: number | null;
  coveredZones?: string | null;
};

export const toGeoSlug = (value: string | null | undefined) =>
  (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

export const parseCoveredZones = (value: string | null | undefined) =>
  (value || '')
    .split(',')
    .map((zone) => toGeoSlug(zone))
    .filter(Boolean);

export const isExperienceCompatibleWithListingZone = (
  experience: ExperienceZoneContext,
  listing: ListingZoneContext
) => {
  const listingCity = toGeoSlug(listing.city);
  const listingZone = toGeoSlug(listing.neighborhood);
  const experienceCity = toGeoSlug(experience.city);
  const experienceZone = toGeoSlug(experience.zone);

  if (!listingCity || listingCity !== experienceCity) {
    return false;
  }

  const coverageType = experience.coverageType || 'FIXED';
  if (coverageType === 'PICKUP') {
    const coveredZones = parseCoveredZones(experience.coveredZones);
    if (!listingZone) {
      return true;
    }
    if (experienceZone && experienceZone === listingZone) {
      return true;
    }
    if (coveredZones.includes(listingZone)) {
      return true;
    }
    return Number(experience.serviceRadiusKm || 0) > 0;
  }

  if (!experienceZone) return true;
  if (!listingZone) return false;
  return experienceZone === listingZone;
};

export const rankExperienceForListingZone = (
  experience: ExperienceZoneContext,
  listing: ListingZoneContext
) => {
  const listingZone = toGeoSlug(listing.neighborhood);
  const experienceZone = toGeoSlug(experience.zone);
  if (!listingZone) return 0;
  if (experienceZone && experienceZone === listingZone) return 3;
  if (parseCoveredZones(experience.coveredZones).includes(listingZone)) return 2;
  if (Number(experience.serviceRadiusKm || 0) > 0) return 1;
  return 0;
};
