import type { Metadata } from 'next';
import type { PublicListingPage } from '@/lib/public-catalog';
import { buildAbsoluteUrl, getSiteUrl, toAbsoluteImageUrl } from '@/lib/url';

export const SITE_NAME = 'Hostea';
export const SITE_LOCALE = 'es_AR';
export const DEFAULT_TITLE = 'Hostea';
export const TITLE_TEMPLATE = `%s | ${SITE_NAME}`;
export const DEFAULT_DESCRIPTION =
  'HOSTEA es una plataforma profesional para descubrir alojamientos, reservar propiedades y gestionar anfitriones con una experiencia moderna y escalable.';
export const DEFAULT_KEYWORDS = [
  'hostea',
  'alojamientos',
  'propiedades',
  'alquiler vacacional',
  'reservas',
  'hospedaje',
  'vacation rentals'
];
export const DEFAULT_OG_IMAGE = '/brand/hostea-logo.jpeg';

export const createMetadataBase = () => new URL(getSiteUrl());

export const getRobotsForPage = (indexable: boolean): NonNullable<Metadata['robots']> =>
  indexable
    ? {
        index: true,
        follow: true,
        googleBot: {
          index: true,
          follow: true,
          'max-image-preview': 'large',
          'max-snippet': -1,
          'max-video-preview': -1
        }
      }
    : {
        index: false,
        follow: false,
        nocache: true,
        googleBot: {
          index: false,
          follow: false,
          'max-image-preview': 'none',
          'max-snippet': -1,
          'max-video-preview': -1
        }
      };

const dedupeKeywords = (keywords?: string[]) =>
  Array.from(new Set([...DEFAULT_KEYWORDS, ...(keywords || [])]));

const cleanDescription = (value?: string | null, fallback = DEFAULT_DESCRIPTION) => {
  const source = (value || fallback).replace(/\s+/g, ' ').trim();
  return source.length <= 160 ? source : `${source.slice(0, 157).trimEnd()}...`;
};

const buildMetadataRecord = ({
  title,
  description,
  path,
  keywords,
  image,
  indexable = true,
  type = 'website'
}: {
  title: string;
  description: string;
  path: string;
  keywords?: string[];
  image?: string | null;
  indexable?: boolean;
  type?: 'website' | 'article';
}): Metadata => {
  const canonical = buildAbsoluteUrl(path);
  const imageUrl = toAbsoluteImageUrl(image, DEFAULT_OG_IMAGE);
  const safeDescription = cleanDescription(description);

  return {
    title,
    description: safeDescription,
    keywords: dedupeKeywords(keywords),
    alternates: {
      canonical,
      languages: {
        'x-default': canonical
      }
    },
    robots: getRobotsForPage(indexable),
    openGraph: {
      type,
      locale: SITE_LOCALE,
      url: canonical,
      title,
      description: safeDescription,
      siteName: SITE_NAME,
      images: [
        {
          url: imageUrl,
          alt: title
        }
      ]
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description: safeDescription,
      images: [imageUrl]
    }
  };
};

const listingTypeLabel = (type?: string | null) =>
  type === 'HOTEL' ? 'hotel' : 'alojamiento';

const pluralize = (count: number, one: string, many: string) => (count === 1 ? one : many);

export const isListingIndexable = (listing?: { status?: string | null } | null) =>
  Boolean(listing && listing.status === 'ACTIVE');

export const buildListingTitle = (listing: PublicListingPage) =>
  `${listing.title} en ${listing.city}`;

export const buildListingDescription = (listing: PublicListingPage) => {
  const parts = [
    `Reserva ${listingTypeLabel(listing.type)} en ${listing.city}.`,
    `${listing.capacity} ${pluralize(listing.capacity, 'huesped', 'huespedes')}.`,
    `${listing.roomTypes.length || 1} ${pluralize(
      listing.roomTypes.length || 1,
      'habitacion',
      'habitaciones'
    )}.`,
    listing.neighborhood ? `Zona ${listing.neighborhood}.` : null,
    'Mira fotos, precios y disponibilidad en Hostea.'
  ].filter(Boolean);

  return cleanDescription(parts.join(' '));
};

export const buildPropertyMetadata = (
  listing?: PublicListingPage | null
): Metadata => {
  if (!listing) {
    return buildMetadataRecord({
      title: 'Propiedad no disponible',
      description: 'La propiedad que buscas no esta disponible en este momento.',
      path: '/search',
      indexable: false
    });
  }

  return buildMetadataRecord({
    title: buildListingTitle(listing),
    description: buildListingDescription(listing),
    path: `/listings/${listing.id}`,
    image: listing.photos[0]?.url,
    indexable: isListingIndexable(listing),
    keywords: [
      listing.city,
      listing.neighborhood,
      listing.type === 'HOTEL' ? 'hotel' : 'departamento',
      'propiedad en alquiler'
    ].filter(Boolean)
  });
};

export const buildCityMetadata = ({
  city,
  country,
  count,
  slug
}: {
  city: string;
  country?: string | null;
  count: number;
  slug: string;
}): Metadata =>
  buildMetadataRecord({
    title: `Alojamientos en ${city}`,
    description: cleanDescription(
      `Explora ${count} alojamientos en ${city}${country ? `, ${country}` : ''}. Encuentra propiedades activas, fotos, precios y disponibilidad en Hostea.`
    ),
    path: `/city/${slug}`,
    keywords: [city, country || '', 'alojamientos por ciudad', 'propiedades'].filter(Boolean)
  });

export const buildCategoryMetadata = ({
  label,
  slug,
  count
}: {
  label: string;
  slug: string;
  count: number;
}): Metadata =>
  buildMetadataRecord({
    title: `${label} en Hostea`,
    description: cleanDescription(
      `Descubre ${count} ${label.toLowerCase()} publicados en Hostea. Compara fotos, ubicaciones, precios y disponibilidad real.`
    ),
    path: `/properties/${slug}`,
    keywords: [label, 'tipos de propiedad', 'alojamientos'].filter(Boolean)
  });

export const buildPageMetadata = ({
  title,
  description,
  path,
  keywords,
  indexable = true
}: {
  title: string;
  description: string;
  path: string;
  keywords?: string[];
  indexable?: boolean;
}): Metadata =>
  buildMetadataRecord({
    title,
    description,
    path,
    keywords,
    indexable
  });
