import type { MetadataRoute } from 'next';
import {
  getCategoryDirectoryEntries,
  getCityDirectoryEntries,
  getSitemapListings
} from '@/lib/public-catalog';
import { buildAbsoluteUrl } from '@/lib/url';

const STATIC_ROUTES: Array<{
  path: string;
  changeFrequency: NonNullable<MetadataRoute.Sitemap[number]['changeFrequency']>;
  priority: number;
}> = [
  { path: '/', changeFrequency: 'daily', priority: 1 },
  { path: '/search', changeFrequency: 'daily', priority: 0.9 },
  { path: '/explorar', changeFrequency: 'daily', priority: 0.8 },
  { path: '/servicios', changeFrequency: 'monthly', priority: 0.6 }
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [listings, cities, categories] = await Promise.all([
    getSitemapListings(),
    getCityDirectoryEntries(),
    getCategoryDirectoryEntries()
  ]);

  const staticEntries: MetadataRoute.Sitemap = STATIC_ROUTES.map((route) => ({
    url: buildAbsoluteUrl(route.path),
    lastModified: new Date(),
    changeFrequency: route.changeFrequency,
    priority: route.priority
  }));

  const cityEntries: MetadataRoute.Sitemap = cities.map((city) => ({
    url: buildAbsoluteUrl(`/city/${city.slug}`),
    lastModified: city.lastModified,
    changeFrequency: 'daily',
    priority: 0.8
  }));

  const categoryEntries: MetadataRoute.Sitemap = categories.map((category) => ({
    url: buildAbsoluteUrl(`/properties/${category.slug}`),
    lastModified: category.lastModified,
    changeFrequency: 'weekly',
    priority: 0.7
  }));

  const listingEntries: MetadataRoute.Sitemap = listings.map((listing) => ({
    url: buildAbsoluteUrl(`/listings/${listing.id}`),
    lastModified: listing.updatedAt,
    changeFrequency: 'weekly',
    priority: 0.9
  }));

  return [...staticEntries, ...cityEntries, ...categoryEntries, ...listingEntries];
}

