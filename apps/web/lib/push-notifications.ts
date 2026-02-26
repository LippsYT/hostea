import { prisma } from '@/lib/db';
import { supabaseAdmin } from '@/lib/supabase';

type DbClient = typeof prisma;

type StoredSubscription = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

export type PushEventPayload = {
  title: string;
  body: string;
  url: string;
  type: string;
};

const hostPushKey = (hostId: string) => `pushNotifications:${hostId}`;

const pushFunctionName = process.env.SUPABASE_PUSH_FUNCTION_NAME || 'send-push';

const parseEnabled = (value: unknown) => {
  if (typeof value === 'boolean') return value;
  if (value && typeof value === 'object' && 'enabled' in (value as any)) {
    return Boolean((value as any).enabled);
  }
  return true;
};

export const getHostPushEnabled = async (hostId: string, db: DbClient = prisma) => {
  const row = await db.settings.findUnique({ where: { key: hostPushKey(hostId) } });
  if (!row) return true;
  return parseEnabled(row.value);
};

export const setHostPushEnabled = async (hostId: string, enabled: boolean, db: DbClient = prisma) => {
  await db.settings.upsert({
    where: { key: hostPushKey(hostId) },
    update: { value: { enabled } },
    create: { key: hostPushKey(hostId), value: { enabled } }
  });
  return enabled;
};

export const savePushSubscription = async (
  hostId: string,
  subscription: StoredSubscription,
  userAgent?: string,
  db: DbClient = prisma
) => {
  return db.pushSubscription.upsert({
    where: { endpoint: subscription.endpoint },
    update: {
      hostId,
      p256dh: subscription.p256dh,
      auth: subscription.auth,
      userAgent: userAgent || null,
      isActive: true,
      lastSeenAt: new Date()
    },
    create: {
      hostId,
      endpoint: subscription.endpoint,
      p256dh: subscription.p256dh,
      auth: subscription.auth,
      userAgent: userAgent || null,
      isActive: true
    }
  });
};

export const sendPushToHost = async (
  hostId: string,
  payload: PushEventPayload,
  db: DbClient = prisma
) => {
  const enabled = await getHostPushEnabled(hostId, db);
  if (!enabled) {
    return { delivered: 0, failed: 0, skipped: 0, reason: 'HOST_DISABLED' as const };
  }

  const subscriptions = await db.pushSubscription.findMany({
    where: { hostId, isActive: true }
  });
  if (!subscriptions.length) {
    return { delivered: 0, failed: 0, skipped: 0, reason: 'NO_DEVICES' as const };
  }

  const { error } = await supabaseAdmin.functions.invoke(pushFunctionName, {
    body: {
      host_id: hostId,
      title: payload.title,
      body: payload.body,
      url: payload.url,
      type: payload.type
    }
  });
  if (error) {
    return { delivered: 0, failed: subscriptions.length, skipped: 0, reason: 'FUNCTION_ERROR' as const };
  }

  await db.pushSubscription.updateMany({
    where: { hostId, isActive: true },
    data: { lastSeenAt: new Date() }
  });

  return { delivered: subscriptions.length, failed: 0, skipped: 0, reason: 'OK' as const };
};
