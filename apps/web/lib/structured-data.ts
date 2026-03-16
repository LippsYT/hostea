import type { PublicListingPage } from '@/lib/public-catalog';
import { buildAbsoluteUrl, toAbsoluteImageUrl } from '@/lib/url';
import { SITE_NAME, DEFAULT_DESCRIPTION } from '@/lib/seo';

const compactObject = <T extends Record<string, unknown>>(value: T) =>
  Object.fromEntries(
    Object.entries(value).filter(([, entry]) => {
      if (entry === null || entry === undefined || entry === '') return false;
      if (Array.isArray(entry)) return entry.length > 0;
      return true;
    })
  );

export const buildOrganizationJsonLd = () =>
  compactObject({
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': buildAbsoluteUrl('/#organization'),
    name: SITE_NAME,
    url: buildAbsoluteUrl('/'),
    logo: toAbsoluteImageUrl('/brand/hostea-logo.jpeg'),
    image: toAbsoluteImageUrl('/brand/hostea-logo.jpeg')
  });

export const buildWebsiteJsonLd = () =>
  compactObject({
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': buildAbsoluteUrl('/#website'),
    name: SITE_NAME,
    url: buildAbsoluteUrl('/'),
    description: DEFAULT_DESCRIPTION,
    potentialAction: {
      '@type': 'SearchAction',
      target: `${buildAbsoluteUrl('/search')}?city={search_term_string}`,
      'query-input': 'required name=search_term_string'
    }
  });

export const buildPropertyJsonLd = (listing: PublicListingPage) => {
  const ratingCount = listing.reviews.length;
  const ratingValue = ratingCount
    ? Number(
        (
          listing.reviews.reduce((total, review) => total + review.rating, 0) / ratingCount
        ).toFixed(1)
      )
    : null;

  return compactObject({
    '@context': 'https://schema.org',
    '@type': 'VacationRental',
    '@id': buildAbsoluteUrl(`/listings/${listing.id}#vacation-rental`),
    identifier: listing.id,
    name: listing.title,
    description: listing.description,
    url: buildAbsoluteUrl(`/listings/${listing.id}`),
    image: listing.photos.map((photo) => toAbsoluteImageUrl(photo.url)),
    address: compactObject({
      '@type': 'PostalAddress',
      streetAddress: listing.address,
      addressLocality: listing.city,
      addressRegion: listing.region || undefined,
      addressCountry: listing.country || undefined
    }),
    geo:
      typeof listing.latitude === 'number' && typeof listing.longitude === 'number'
        ? {
            '@type': 'GeoCoordinates',
            latitude: listing.latitude,
            longitude: listing.longitude
          }
        : undefined,
    occupancy: {
      '@type': 'QuantitativeValue',
      maxValue: listing.capacity
    },
    numberOfRooms: listing.roomTypes.length || undefined,
    petsAllowed: listing.allowPets || undefined,
    amenityFeature: listing.amenities.map((item) => ({
      '@type': 'LocationFeatureSpecification',
      name: item.amenity.name,
      value: true
    })),
    aggregateRating:
      ratingCount > 0 && ratingValue
        ? {
            '@type': 'AggregateRating',
            ratingValue,
            reviewCount: ratingCount
          }
        : undefined,
    review: listing.reviews.slice(0, 5).map((review) =>
      compactObject({
        '@type': 'Review',
        reviewBody: review.comment || undefined,
        reviewRating: {
          '@type': 'Rating',
          ratingValue: review.rating
        },
        datePublished: review.createdAt.toISOString(),
        author: {
          '@type': 'Person',
          name: 'Huesped Hostea'
        }
      })
    ),
    priceRange: `USD ${Number(listing.pricePerNight).toFixed(0)}+`
  });
};

export const buildBreadcrumbJsonLd = (
  items: Array<{ name: string; path: string }>
) => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: items.map((item, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    name: item.name,
    item: buildAbsoluteUrl(item.path)
  }))
});

