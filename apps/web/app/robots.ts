import type { MetadataRoute } from 'next';
import { buildAbsoluteUrl } from '@/lib/url';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/auth/',
          '/dashboard/',
          '/cancel',
          '/success',
          '/debug/',
          '/host/'
        ]
      }
    ],
    sitemap: buildAbsoluteUrl('/sitemap.xml'),
    host: buildAbsoluteUrl('/')
  };
}

