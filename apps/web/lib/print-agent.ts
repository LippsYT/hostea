import { PrismaClient } from '@prisma/client';
import { getAdminPrintSettings, PrintJobPayload } from '@/lib/print-jobs';

const normalizeAgentBaseUrl = (ipOrUrl: string | null) => {
  if (!ipOrUrl) return null;
  const value = ipOrUrl.trim();
  if (!value) return null;
  if (value.startsWith('http://') || value.startsWith('https://')) {
    return value.replace(/\/+$/, '');
  }
  return `http://${value.replace(/\/+$/, '')}:3333`;
};

const withTimeout = async (url: string, init: RequestInit, timeoutMs = 8000) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
};

const money = (currency: string, value: number) =>
  `${currency} ${Number(value || 0).toFixed(2)}`;

const toPrintableText = (payload: PrintJobPayload) => `HOSTEA
------------------------
Reserva #${payload.reservationCode}
Cliente: ${payload.guestName}
Propiedad: ${payload.propertyName}
Check-in: ${payload.checkIn}
Check-out: ${payload.checkOut}

Total cliente: ${money(payload.currency, payload.totalClient)}
Ganancia host: ${money(payload.currency, payload.netHost)}
Ganancia hostea: ${money(payload.currency, payload.hosteaFee)}

Fecha: ${new Date().toLocaleString('es-AR')}
------------------------`;

export const sendReservationPrintToAgent = async (
  db: PrismaClient | any,
  payload: PrintJobPayload
) => {
  const settings = await getAdminPrintSettings(db);
  if (!settings.autoPrintEnabled) {
    return { ok: false, skipped: true, reason: 'disabled' as const };
  }

  const baseUrl = normalizeAgentBaseUrl(settings.printerAgentIp);
  if (!baseUrl) {
    return { ok: false, skipped: true, reason: 'missing_agent_ip' as const };
  }
  if (!settings.printApiKey) {
    return { ok: false, skipped: true, reason: 'missing_api_key' as const };
  }

  const res = await withTimeout(`${baseUrl}/print`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': settings.printApiKey
    },
    body: JSON.stringify({ text: toPrintableText(payload) })
  });

  if (!res.ok) {
    const raw = await res.text().catch(() => '');
    throw new Error(`Print agent error ${res.status}: ${raw || 'sin respuesta'}`);
  }

  return { ok: true };
};

export const sendPrintTestToAgent = async (
  db: PrismaClient | any
) => {
  const settings = await getAdminPrintSettings(db);
  const baseUrl = normalizeAgentBaseUrl(settings.printerAgentIp);
  if (!baseUrl) {
    throw new Error('Configura la IP/URL del agente de impresion.');
  }
  if (!settings.printApiKey) {
    throw new Error('Configura PRINT_API_KEY del agente.');
  }

  const text = `HOSTEA - PRUEBA
------------------------
Fecha: ${new Date().toLocaleString('es-AR')}
Si lees este ticket, la integracion esta OK.
------------------------`;

  const res = await withTimeout(`${baseUrl}/print/test`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': settings.printApiKey
    },
    body: JSON.stringify({ text })
  });

  if (!res.ok) {
    const raw = await res.text().catch(() => '');
    throw new Error(`Print test error ${res.status}: ${raw || 'sin respuesta'}`);
  }
};
