const DEFAULT_APP_ORIGIN = 'https://gohostea.com';
const isProduction = process.env.NODE_ENV === 'production';

const sanitizeCandidate = (value: string) => {
  let candidate = value.trim();
  if (!candidate) return '';

  // Fix common malformed env values such as "https://https://gohostea.com".
  candidate = candidate.replace(/^(https?:\/\/)(https?:\/\/)/i, '$2');
  candidate = candidate.replace(/^https?:\/(?!\/)/i, 'https://');

  if (!/^https?:\/\//i.test(candidate)) {
    candidate = `https://${candidate.replace(/^\/+/, '')}`;
  }

  return candidate;
};

const isLocalHostName = (hostname: string) => {
  const normalized = hostname.toLowerCase();
  return (
    normalized === 'localhost' ||
    normalized === '127.0.0.1' ||
    normalized === '0.0.0.0' ||
    normalized.endsWith('.local')
  );
};

const toOrigin = (value: string) => {
  try {
    const url = new URL(value);
    if (!url.hostname || ['https', 'http'].includes(url.hostname.toLowerCase())) {
      return null;
    }
    if (isProduction && isLocalHostName(url.hostname)) {
      return null;
    }
    return url.origin;
  } catch {
    return null;
  }
};

export const resolveAppOrigin = (requestUrl?: string) => {
  const candidates = [
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.APP_URL,
    process.env.NEXTAUTH_URL,
    requestUrl
  ].filter(Boolean) as string[];

  for (const raw of candidates) {
    const origin = toOrigin(sanitizeCandidate(raw));
    if (origin) return origin;
  }

  return DEFAULT_APP_ORIGIN;
};

export const buildAppUrl = (path: string, requestUrl?: string) => {
  const base = resolveAppOrigin(requestUrl);
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${normalizedPath}`;
};
