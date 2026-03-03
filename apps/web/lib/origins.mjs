const LOCAL_FALLBACK = 'http://localhost:3000';

const trimSlash = (value) => (value || '').trim().replace(/\/+$/, '');

const unique = (values) => Array.from(new Set(values.filter(Boolean)));

const fromEnvList = (value) =>
  (value || '')
    .split(',')
    .map((item) => trimSlash(item))
    .filter(Boolean);

export const getAppOrigin = () => {
  const candidates = [
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.NEXTAUTH_URL,
    process.env.APP_URL,
    process.env.BASE_URL,
    LOCAL_FALLBACK
  ];

  for (const candidate of candidates) {
    const origin = trimSlash(candidate);
    if (!origin) continue;
    try {
      return new URL(origin).origin;
    } catch {
      // Ignore invalid env values and keep trying.
    }
  }

  return LOCAL_FALLBACK;
};

export const getAllowedOrigins = () => {
  const explicitOrigins = fromEnvList(process.env.CORS_ALLOWED_ORIGINS);
  if (explicitOrigins.length > 0) {
    return unique(explicitOrigins);
  }

  const primary = getAppOrigin();
  try {
    const parsed = new URL(primary);
    const host = parsed.hostname;
    if (host === 'localhost' || host === '127.0.0.1') {
      return [primary];
    }

    const secondaryHost = host.startsWith('www.')
      ? host.replace(/^www\./, '')
      : `www.${host}`;

    const secondary = `${parsed.protocol}//${secondaryHost}`;
    return unique([primary, secondary]);
  } catch {
    return [primary];
  }
};
