const FALLBACK_SITE_URL = 'https://gohostea.com';

export const DEFAULT_OG_IMAGE_PATH = '/brand/hostea-logo.jpeg';

const normalizeBaseUrl = (value?: string | null) => {
  const trimmed = value?.trim();
  if (!trimmed) return FALLBACK_SITE_URL;
  return trimmed.replace(/\/+$/, '');
};

export const getSiteUrl = () =>
  normalizeBaseUrl(process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL);

export const buildAbsoluteUrl = (path = '/') => {
  if (/^https?:\/\//i.test(path)) return path;
  return new URL(path.startsWith('/') ? path : `/${path}`, `${getSiteUrl()}/`).toString();
};

export const toAbsoluteImageUrl = (url?: string | null, fallback = DEFAULT_OG_IMAGE_PATH) =>
  buildAbsoluteUrl(url || fallback);

