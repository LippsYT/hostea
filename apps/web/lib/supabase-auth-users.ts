import type { User as SupabaseAuthUser } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase';

export type SupabaseAuthAccountStatus = 'missing' | 'pending' | 'confirmed';

export type SupabaseAuthAccountMatch = {
  status: SupabaseAuthAccountStatus;
  user: SupabaseAuthUser | null;
};

type LocalUserLite = { id: string; email: string };

type SupabaseAuthIndex = {
  byInternalId: Map<string, SupabaseAuthUser>;
  byEmail: Map<string, SupabaseAuthUser>;
};

const normalizeEmail = (email: string) => email.trim().toLowerCase();

const readInternalUserId = (user: SupabaseAuthUser) => {
  const fromUserMeta = user.user_metadata?.internal_user_id;
  if (typeof fromUserMeta === 'string' && fromUserMeta.trim().length > 0) return fromUserMeta;
  const fromAppMeta = (user.app_metadata as Record<string, unknown> | undefined)?.internal_user_id;
  if (typeof fromAppMeta === 'string' && fromAppMeta.trim().length > 0) return fromAppMeta;
  return null;
};

export const listSupabaseAuthUsers = async () => {
  const perPage = 200;
  const users: SupabaseAuthUser[] = [];

  for (let page = 1; page <= 50; page += 1) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(error.message || 'No se pudo listar usuarios de Supabase Auth.');
    users.push(...data.users);
    if (data.users.length < perPage) break;
  }

  return users;
};

export const buildSupabaseAuthIndex = (users: SupabaseAuthUser[]): SupabaseAuthIndex => {
  const byInternalId = new Map<string, SupabaseAuthUser>();
  const byEmail = new Map<string, SupabaseAuthUser>();

  for (const user of users) {
    const internalUserId = readInternalUserId(user);
    if (internalUserId && !byInternalId.has(internalUserId)) {
      byInternalId.set(internalUserId, user);
    }
    if (user.email) {
      const email = normalizeEmail(user.email);
      if (!byEmail.has(email)) byEmail.set(email, user);
    }
  }

  return { byInternalId, byEmail };
};

export const resolveSupabaseAuthForLocalUser = (
  localUser: LocalUserLite,
  index: SupabaseAuthIndex
): SupabaseAuthAccountMatch => {
  const byId = index.byInternalId.get(localUser.id);
  const matched = byId || index.byEmail.get(normalizeEmail(localUser.email)) || null;
  if (!matched) return { status: 'missing', user: null };
  if (matched.email_confirmed_at) return { status: 'confirmed', user: matched };
  return { status: 'pending', user: matched };
};

