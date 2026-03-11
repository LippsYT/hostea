import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';

type DbClient = typeof prisma;

export type HostQuickReply = {
  id: string;
  label: string;
  body: string;
  category: string;
  favorite: boolean;
  enabled: boolean;
};

export type HostMessagingConfig = {
  enabled: boolean;
  templates: {
    inquiry: string;
    reservationConfirmed: string;
    preCheckIn: string;
    welcome: string;
    checkOut: string;
  };
  quickReplies: HostQuickReply[];
  suspicious: {
    keywords: string[];
    autoReplyEnabled: boolean;
    autoReplyMessage: string;
  };
};

const settingsKey = (hostId: string) => `hostMessagingConfig:${hostId}`;

export const DEFAULT_SUSPICIOUS_KEYWORDS = [
  'pagar directo',
  'efectivo',
  'transferencia al alojamiento',
  'por fuera',
  'sin plataforma',
  'whatsapp'
];

export const defaultHostMessagingConfig = (): HostMessagingConfig => ({
  enabled: true,
  templates: {
    inquiry:
      'Hola {guest_name}, gracias por tu consulta sobre {property_name}. Te respondo en breve.',
    reservationConfirmed:
      'Reserva confirmada para {property_name}. Check-in: {check_in}. Check-out: {check_out}.',
    preCheckIn:
      'Hola {guest_name}, te recordamos tu check-in en {property_name} para {check_in}.',
    welcome:
      'Bienvenido a {property_name}, {guest_name}. Cualquier duda me escribes por aqui.',
    checkOut:
      'Gracias por tu estadia en {property_name}. Tu check-out es {check_out}.'
  },
  quickReplies: [
    {
      id: 'availability',
      label: 'Disponibilidad',
      body: 'Si, tenemos disponibilidad para esas fechas. Si quieres, te ayudo a confirmar ahora.',
      category: 'Reserva',
      favorite: true,
      enabled: true
    },
    {
      id: 'checkin',
      label: 'Check-in',
      body: 'Perfecto. El check-in es desde las 15:00 y te comparto instrucciones el dia anterior.',
      category: 'Check-in',
      favorite: false,
      enabled: true
    },
    {
      id: 'payment',
      label: 'Pago en plataforma',
      body: 'Por seguridad, todo pago y confirmacion se realiza dentro de Hostea.',
      category: 'Pagos',
      favorite: false,
      enabled: true
    }
  ],
  suspicious: {
    keywords: DEFAULT_SUSPICIOUS_KEYWORDS,
    autoReplyEnabled: true,
    autoReplyMessage:
      'Por seguridad, toda reserva y pago debe completarse dentro de Hostea.'
  }
});

const normalizeQuickReplies = (value: unknown): HostQuickReply[] => {
  if (!Array.isArray(value)) return defaultHostMessagingConfig().quickReplies;
  const safe = value
    .map((item, index) => {
      if (!item || typeof item !== 'object') return null;
      const row = item as Record<string, unknown>;
      const label = String(row.label || '').trim();
      const body = String(row.body || '').trim();
      if (!label || !body) return null;
      const id = String(row.id || `reply-${index + 1}`).trim();
      const category = String(row.category || 'General').trim() || 'General';
      return {
        id,
        label: label.slice(0, 80),
        body: body.slice(0, 400),
        category: category.slice(0, 40),
        favorite: row.favorite === true,
        enabled: row.enabled !== false
      };
    })
    .filter((item): item is HostQuickReply => Boolean(item));
  return safe.length ? safe : defaultHostMessagingConfig().quickReplies;
};

const normalizeKeywords = (value: unknown): string[] => {
  if (!Array.isArray(value)) return DEFAULT_SUSPICIOUS_KEYWORDS;
  const safe = value
    .map((item) => String(item || '').trim().toLowerCase())
    .filter(Boolean);
  return safe.length ? Array.from(new Set(safe)) : DEFAULT_SUSPICIOUS_KEYWORDS;
};

const mergeConfig = (value: unknown): HostMessagingConfig => {
  const defaults = defaultHostMessagingConfig();
  const raw = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const templatesRaw =
    raw.templates && typeof raw.templates === 'object'
      ? (raw.templates as Record<string, unknown>)
      : {};
  const suspiciousRaw =
    raw.suspicious && typeof raw.suspicious === 'object'
      ? (raw.suspicious as Record<string, unknown>)
      : {};

  return {
    enabled: raw.enabled === false ? false : true,
    templates: {
      inquiry: String(templatesRaw.inquiry || defaults.templates.inquiry),
      reservationConfirmed: String(
        templatesRaw.reservationConfirmed || defaults.templates.reservationConfirmed
      ),
      preCheckIn: String(templatesRaw.preCheckIn || defaults.templates.preCheckIn),
      welcome: String(templatesRaw.welcome || defaults.templates.welcome),
      checkOut: String(templatesRaw.checkOut || defaults.templates.checkOut)
    },
    quickReplies: normalizeQuickReplies(raw.quickReplies),
    suspicious: {
      keywords: normalizeKeywords(suspiciousRaw.keywords),
      autoReplyEnabled:
        suspiciousRaw.autoReplyEnabled === false
          ? false
          : defaults.suspicious.autoReplyEnabled,
      autoReplyMessage: String(
        suspiciousRaw.autoReplyMessage || defaults.suspicious.autoReplyMessage
      )
    }
  };
};

export const getHostMessagingConfig = async (
  hostId: string,
  db: DbClient = prisma
): Promise<HostMessagingConfig> => {
  const row = await db.settings.findUnique({ where: { key: settingsKey(hostId) } });
  return mergeConfig(row?.value || null);
};

export const saveHostMessagingConfig = async (
  hostId: string,
  config: unknown,
  db: DbClient = prisma
) => {
  const safeValue = mergeConfig(config);
  await db.settings.upsert({
    where: { key: settingsKey(hostId) },
    update: { value: safeValue },
    create: { key: settingsKey(hostId), value: safeValue }
  });
  return safeValue;
};

export const renderHostTemplate = (
  template: string,
  variables: Record<string, string | number | null | undefined>
) => {
  return Object.entries(variables).reduce((acc, [key, value]) => {
    const safe = value === null || value === undefined ? '' : String(value);
    return acc.replaceAll(`{${key}}`, safe);
  }, template);
};

const normalizeText = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

export const extractSuspiciousKeywords = (
  text: string,
  keywords: string[] = DEFAULT_SUSPICIOUS_KEYWORDS
) => {
  const normalizedBody = normalizeText(text);
  const matches = keywords.filter((keyword) =>
    normalizedBody.includes(normalizeText(keyword))
  );
  return Array.from(new Set(matches));
};

export const getRiskThreadIds = async (
  threadIds: string[],
  db: DbClient = prisma
) => {
  if (!threadIds.length) return new Set<string>();
  const rows = await db.auditLog.findMany({
    where: {
      entity: 'MessageThread',
      action: 'THREAD_RISK_FLAGGED',
      entityId: { in: threadIds }
    },
    select: { entityId: true }
  });
  return new Set(rows.map((row) => row.entityId));
};

export const hasAutoMessageAudit = async (
  reservationId: string,
  action: string,
  db: DbClient = prisma
) => {
  const row = await db.auditLog.findFirst({
    where: {
      entity: 'Reservation',
      entityId: reservationId,
      action
    },
    select: { id: true }
  });
  return Boolean(row);
};

export const markAutoMessageAudit = async (
  reservationId: string,
  actorId: string,
  action: string,
  meta: Prisma.InputJsonValue,
  db: DbClient = prisma
) => {
  await db.auditLog.create({
    data: {
      actorId,
      action,
      entity: 'Reservation',
      entityId: reservationId,
      meta
    }
  });
};
