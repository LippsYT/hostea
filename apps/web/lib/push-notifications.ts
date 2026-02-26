import { prisma } from '@/lib/db';
import { supabaseAdmin } from '@/lib/supabase';

type DbClient = typeof prisma;

type StoredSubscription = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

export type PushUserRole = 'host' | 'client';

export type PushEventPayload = {
  title: string;
  body: string;
  url: string;
  type: string;
  tag?: string;
};

const pushSettingsKey = (userId: string, role: PushUserRole) => `pushNotifications:${role}:${userId}`;

const pushFunctionName = process.env.SUPABASE_PUSH_FUNCTION_NAME || 'send-push';

const parseEnabled = (value: unknown) => {
  if (typeof value === 'boolean') return value;
  if (value && typeof value === 'object' && 'enabled' in (value as any)) {
    return Boolean((value as any).enabled);
  }
  return true;
};

export const getHostPushEnabled = async (hostId: string, db: DbClient = prisma) => {
  const row = await db.settings.findUnique({ where: { key: pushSettingsKey(hostId, 'host') } });
  if (!row) return true;
  return parseEnabled(row.value);
};

export const setHostPushEnabled = async (hostId: string, enabled: boolean, db: DbClient = prisma) => {
  await db.settings.upsert({
    where: { key: pushSettingsKey(hostId, 'host') },
    update: { value: { enabled } },
    create: { key: pushSettingsKey(hostId, 'host'), value: { enabled } }
  });
  return enabled;
};

export const getPushEnabled = async (
  userId: string,
  role: PushUserRole,
  db: DbClient = prisma
) => {
  const row = await db.settings.findUnique({ where: { key: pushSettingsKey(userId, role) } });
  if (!row) return true;
  return parseEnabled(row.value);
};

export const setPushEnabled = async (
  userId: string,
  role: PushUserRole,
  enabled: boolean,
  db: DbClient = prisma
) => {
  await db.settings.upsert({
    where: { key: pushSettingsKey(userId, role) },
    update: { value: { enabled } },
    create: { key: pushSettingsKey(userId, role), value: { enabled } }
  });
  return enabled;
};

export const savePushSubscription = async (
  userId: string,
  role: PushUserRole,
  subscription: StoredSubscription,
  userAgent?: string,
  db: DbClient = prisma
) => {
  return db.pushSubscription.upsert({
    where: { endpoint: subscription.endpoint },
    update: {
      hostId: userId,
      role,
      p256dh: subscription.p256dh,
      auth: subscription.auth,
      userAgent: userAgent || null,
      isActive: true,
      lastSeenAt: new Date()
    },
    create: {
      hostId: userId,
      role,
      endpoint: subscription.endpoint,
      p256dh: subscription.p256dh,
      auth: subscription.auth,
      userAgent: userAgent || null,
      isActive: true
    }
  });
};

export const removePushSubscription = async (
  userId: string,
  role: PushUserRole,
  endpoint?: string,
  db: DbClient = prisma
) => {
  if (endpoint) {
    await db.pushSubscription.deleteMany({
      where: { hostId: userId, role, endpoint }
    });
    return;
  }
  await db.pushSubscription.updateMany({
    where: { hostId: userId, role, isActive: true },
    data: { isActive: false }
  });
};

export const getPushStatus = async (userId: string, role: PushUserRole, db: DbClient = prisma) => {
  const [enabled, activeDevices] = await Promise.all([
    getPushEnabled(userId, role, db),
    db.pushSubscription.count({ where: { hostId: userId, role, isActive: true } })
  ]);
  return {
    enabled,
    activeDevices,
    vapidPublicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ''
  };
};

export const sendPushToUser = async (
  userId: string,
  role: PushUserRole,
  payload: PushEventPayload,
  db: DbClient = prisma
) => {
  const enabled = await getPushEnabled(userId, role, db);
  if (!enabled) {
    return { delivered: 0, failed: 0, skipped: 0, reason: 'USER_DISABLED' as const };
  }

  const subscriptions = await db.pushSubscription.findMany({
    where: { hostId: userId, role, isActive: true }
  });
  if (!subscriptions.length) {
    return { delivered: 0, failed: 0, skipped: 0, reason: 'NO_DEVICES' as const };
  }

  const { error } = await supabaseAdmin.functions.invoke(pushFunctionName, {
    body: {
      userId,
      role,
      title: payload.title,
      body: payload.body,
      url: payload.url,
      tag: payload.tag || payload.type
    }
  });
  if (error) {
    return { delivered: 0, failed: subscriptions.length, skipped: 0, reason: 'FUNCTION_ERROR' as const };
  }

  await db.pushSubscription.updateMany({
    where: { hostId: userId, role, isActive: true },
    data: { lastSeenAt: new Date() }
  });

  return { delivered: subscriptions.length, failed: 0, skipped: 0, reason: 'OK' as const };
};

export const sendPushToHost = async (
  hostId: string,
  payload: PushEventPayload,
  db: DbClient = prisma
) => {
  return sendPushToUser(hostId, 'host', payload, db);
};

export const sendPushToClient = async (
  clientId: string,
  payload: PushEventPayload,
  db: DbClient = prisma
) => {
  return sendPushToUser(clientId, 'client', payload, db);
};
