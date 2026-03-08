import { createClient } from '@supabase/supabase-js';

const resolveSupabaseUrl = () =>
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';

const resolveSupabaseAnonKey = () =>
  process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const getSupabasePublicServerClient = () => {
  const url = resolveSupabaseUrl();
  const anonKey = resolveSupabaseAnonKey();
  if (!url || !anonKey) {
    throw new Error('Supabase Auth no configurado: faltan SUPABASE_URL o SUPABASE_ANON_KEY');
  }

  return createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
};

export const getAppBaseUrl = (req?: Request) => {
  const envCandidate =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXTAUTH_URL ||
    process.env.APP_URL ||
    process.env.BASE_URL;

  if (envCandidate) {
    try {
      return new URL(envCandidate).origin;
    } catch {
      // ignore invalid env url and fallback to request
    }
  }

  if (req) {
    try {
      return new URL(req.url).origin;
    } catch {
      // ignore and fallback to localhost
    }
  }

  return 'http://localhost:3000';
};
