const DEFAULT_APP_ORIGIN = 'https://gohostea.com';

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

const toOrigin = (value: string) => {
  try {
    const url = new URL(value);
    if (!url.hostname || ['https', 'http'].includes(url.hostname.toLowerCase())) {
      return null;
    }
    return url.origin;
  } catch {
    return null;
  }
};

export const resolveAppOrigin = (requestUrl?: string) => {
  const candidates = [
    requestUrl,
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.APP_URL,
    process.env.NEXTAUTH_URL
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
