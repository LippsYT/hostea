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

export type HostAutomationKey =
  | 'inquiry'
  | 'reservation_confirmed'
  | 'pre_checkin'
  | 'post_checkout';

export type HostAutomationConfig = {
  enabled: boolean;
  templateId: string | null;
};

export type HostMessagingConfig = {
  quickReplies: HostQuickReply[];
  automations: Record<HostAutomationKey, HostAutomationConfig>;
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

const TEMPLATE_IDS = {
  inquiry: 'tpl-inquiry-default',
  reservation_confirmed: 'tpl-reservation-confirmed-default',
  pre_checkin: 'tpl-pre-checkin-default',
  post_checkout: 'tpl-post-checkout-default',
  welcome: 'tpl-welcome-default'
} as const;

const defaultReplyTemplates = (): HostQuickReply[] => [
  {
    id: TEMPLATE_IDS.inquiry,
    label: 'Respuesta de consulta',
    body: 'Hola {guest_name}, gracias por tu consulta sobre {property_name}. Te respondo en breve.',
    category: 'Automatizaciones',
    favorite: false,
    enabled: true
  },
  {
    id: TEMPLATE_IDS.reservation_confirmed,
    label: 'Reserva confirmada',
    body: 'Reserva confirmada para {property_name}. Check-in: {check_in}. Check-out: {check_out}. Codigo: {booking_code}.',
    category: 'Automatizaciones',
    favorite: false,
    enabled: true
  },
  {
    id: TEMPLATE_IDS.pre_checkin,
    label: 'Antes del check-in',
    body: 'Hola {guest_name}, te recordamos tu check-in en {property_name} para {check_in}.',
    category: 'Automatizaciones',
    favorite: false,
    enabled: true
  },
  {
    id: TEMPLATE_IDS.post_checkout,
    label: 'Despues del check-out',
    body: 'Gracias por tu estadia en {property_name}. Esperamos volver a recibirte.',
    category: 'Automatizaciones',
    favorite: false,
    enabled: true
  },
  {
    id: TEMPLATE_IDS.welcome,
    label: 'Bienvenida',
    body: 'Bienvenido a {property_name}, {guest_name}. Cualquier duda me escribes por aqui.',
    category: 'Recepcion',
    favorite: false,
    enabled: true
  },
  {
    id: 'reply-availability',
    label: 'Disponibilidad',
    body: 'Si, tenemos disponibilidad para esas fechas. Si quieres, te ayudo a confirmar ahora.',
    category: 'Reserva',
    favorite: true,
    enabled: true
  },
  {
    id: 'reply-checkin',
    label: 'Check-in',
    body: 'Perfecto. El check-in es desde las 15:00 y te comparto instrucciones el dia anterior.',
    category: 'Check-in',
    favorite: false,
    enabled: true
  },
  {
    id: 'reply-payment',
    label: 'Pago en plataforma',
    body: 'Por seguridad, todo pago y confirmacion se realiza dentro de Hostea.',
    category: 'Pagos',
    favorite: false,
    enabled: true
  }
];

const defaultAutomations = (): Record<HostAutomationKey, HostAutomationConfig> => ({
  inquiry: { enabled: true, templateId: TEMPLATE_IDS.inquiry },
  reservation_confirmed: { enabled: true, templateId: TEMPLATE_IDS.reservation_confirmed },
  pre_checkin: { enabled: true, templateId: TEMPLATE_IDS.pre_checkin },
  post_checkout: { enabled: false, templateId: TEMPLATE_IDS.post_checkout }
});

export const defaultHostMessagingConfig = (): HostMessagingConfig => ({
  quickReplies: defaultReplyTemplates(),
  automations: defaultAutomations(),
  suspicious: {
    keywords: DEFAULT_SUSPICIOUS_KEYWORDS,
    autoReplyEnabled: true,
    autoReplyMessage: 'Por seguridad, toda reserva y pago debe completarse dentro de Hostea.'
  }
});

const normalizeQuickReplies = (value: unknown): HostQuickReply[] => {
  if (!Array.isArray(value)) return [];
  const safe = value
    .map((item, index) => {
      if (!item || typeof item !== 'object') return null;
      const row = item as Record<string, unknown>;
      const label = String(row.label || '').trim();
      const body = String(row.body || '').trim();
      const category = String(row.category || 'General').trim();
      if (!label || !body) return null;
      const id = String(row.id || `reply-${index + 1}`).trim();
      return {
        id: id.slice(0, 80),
        label: label.slice(0, 80),
        body: body.slice(0, 400),
        category: (category || 'General').slice(0, 40),
        favorite: row.favorite === true,
        enabled: row.enabled !== false
      };
    })
    .filter((item): item is HostQuickReply => Boolean(item));
  return safe;
};

const normalizeKeywords = (value: unknown): string[] => {
  if (!Array.isArray(value)) return DEFAULT_SUSPICIOUS_KEYWORDS;
  const safe = value.map((item) => String(item || '').trim().toLowerCase()).filter(Boolean);
  return safe.length ? Array.from(new Set(safe)) : DEFAULT_SUSPICIOUS_KEYWORDS;
};

const normalizeAutomations = (
  value: unknown
): Record<HostAutomationKey, HostAutomationConfig> => {
  const defaults = defaultAutomations();
  const raw = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const parse = (key: HostAutomationKey): HostAutomationConfig => {
    const row = raw[key] && typeof raw[key] === 'object' ? (raw[key] as Record<string, unknown>) : {};
    const templateId = typeof row.templateId === 'string' && row.templateId.trim() ? row.templateId.trim() : defaults[key].templateId;
    return {
      enabled: row.enabled === false ? false : defaults[key].enabled,
      templateId
    };
  };
  return {
    inquiry: parse('inquiry'),
    reservation_confirmed: parse('reservation_confirmed'),
    pre_checkin: parse('pre_checkin'),
    post_checkout: parse('post_checkout')
  };
};

const mergeLegacyTemplatesIntoReplies = (
  replies: HostQuickReply[],
  legacyTemplates: Record<string, unknown>
) => {
  const patched = [...replies];
  const applyLegacy = (id: string, key: string) => {
    const value = String(legacyTemplates[key] || '').trim();
    if (!value) return;
    const index = patched.findIndex((reply) => reply.id === id);
    if (index >= 0) {
      patched[index] = { ...patched[index], body: value };
    }
  };
  applyLegacy(TEMPLATE_IDS.inquiry, 'inquiry');
  applyLegacy(TEMPLATE_IDS.reservation_confirmed, 'reservationConfirmed');
  applyLegacy(TEMPLATE_IDS.pre_checkin, 'preCheckIn');
  applyLegacy(TEMPLATE_IDS.post_checkout, 'checkOut');
  applyLegacy(TEMPLATE_IDS.welcome, 'welcome');
  return patched;
};

const ensureDefaultTemplates = (replies: HostQuickReply[]) => {
  const defaults = defaultReplyTemplates();
  const map = new Map(replies.map((reply) => [reply.id, reply]));
  for (const template of defaults) {
    if (!map.has(template.id)) {
      map.set(template.id, template);
    }
  }
  return Array.from(map.values());
};

const mergeConfig = (value: unknown): HostMessagingConfig => {
  const defaults = defaultHostMessagingConfig();
  const raw = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const suspiciousRaw =
    raw.suspicious && typeof raw.suspicious === 'object'
      ? (raw.suspicious as Record<string, unknown>)
      : {};
  const legacyTemplates =
    raw.templates && typeof raw.templates === 'object'
      ? (raw.templates as Record<string, unknown>)
      : {};

  let replies = normalizeQuickReplies(raw.quickReplies);
  replies = ensureDefaultTemplates(replies);
  replies = mergeLegacyTemplatesIntoReplies(replies, legacyTemplates);

  const automations = normalizeAutomations(raw.automations);
  if (raw.enabled === false) {
    (Object.keys(automations) as HostAutomationKey[]).forEach((key) => {
      automations[key].enabled = false;
    });
  }

  return {
    quickReplies: replies,
    automations,
    suspicious: {
      keywords: normalizeKeywords(suspiciousRaw.keywords),
      autoReplyEnabled:
        suspiciousRaw.autoReplyEnabled === false ? false : defaults.suspicious.autoReplyEnabled,
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

const getTemplateById = (config: HostMessagingConfig, templateId: string | null | undefined) => {
  if (!templateId) return null;
  return config.quickReplies.find((reply) => reply.id === templateId) || null;
};

export const resolveAutomationTemplate = (
  config: HostMessagingConfig,
  automationKey: HostAutomationKey
) => {
  const automation = config.automations[automationKey];
  if (!automation?.enabled) return null;
  const template = getTemplateById(config, automation.templateId);
  if (!template || !template.enabled || !template.body.trim()) return null;
  return template;
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

export const getRiskThreadIds = async (threadIds: string[], db: DbClient = prisma) => {
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
