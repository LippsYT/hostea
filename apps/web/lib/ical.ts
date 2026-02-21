import { randomUUID } from 'crypto';

export type ParsedIcalEvent = {
  uid: string;
  startDate: Date;
  endDate: Date;
  summary?: string;
};

type RawLine = {
  key: string;
  value: string;
};

const normalizeLineEndings = (value: string) => value.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

const unfoldLines = (ics: string) => {
  const lines = normalizeLineEndings(ics).split('\n');
  const out: string[] = [];
  for (const line of lines) {
    if (!line) continue;
    if ((line.startsWith(' ') || line.startsWith('\t')) && out.length > 0) {
      out[out.length - 1] += line.slice(1);
    } else {
      out.push(line);
    }
  }
  return out;
};

const parseRawLine = (line: string): RawLine | null => {
  const idx = line.indexOf(':');
  if (idx === -1) return null;
  return {
    key: line.slice(0, idx).toUpperCase(),
    value: line.slice(idx + 1).trim()
  };
};

const isDateOnlyKey = (key: string, value: string) => key.includes('VALUE=DATE') || /^\d{8}$/.test(value);

const parseIcalDateValue = (value: string, dateOnly: boolean) => {
  if (dateOnly) {
    const y = Number(value.slice(0, 4));
    const m = Number(value.slice(4, 6));
    const d = Number(value.slice(6, 8));
    return new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
  }

  const cleaned = value.replace(/[-:]/g, '');
  const z = cleaned.endsWith('Z');
  const raw = z ? cleaned.slice(0, -1) : cleaned;
  const y = Number(raw.slice(0, 4));
  const m = Number(raw.slice(4, 6));
  const d = Number(raw.slice(6, 8));
  const hh = Number(raw.slice(9, 11) || '0');
  const mm = Number(raw.slice(11, 13) || '0');
  const ss = Number(raw.slice(13, 15) || '0');
  if (z) return new Date(Date.UTC(y, m - 1, d, hh, mm, ss));
  return new Date(y, m - 1, d, hh, mm, ss);
};

export const parseIcsEvents = (ics: string): ParsedIcalEvent[] => {
  const lines = unfoldLines(ics);
  const events: ParsedIcalEvent[] = [];
  let inEvent = false;
  let eventLines: RawLine[] = [];

  const flush = () => {
    if (!eventLines.length) return;

    const status = eventLines.find((line) => line.key.startsWith('STATUS'))?.value?.toUpperCase();
    if (status === 'CANCELLED') {
      eventLines = [];
      return;
    }

    const uid = eventLines.find((line) => line.key.startsWith('UID'))?.value || randomUUID();
    const startRaw = eventLines.find((line) => line.key.startsWith('DTSTART'));
    const endRaw = eventLines.find((line) => line.key.startsWith('DTEND'));
    const summary = eventLines.find((line) => line.key.startsWith('SUMMARY'))?.value;

    if (!startRaw) {
      eventLines = [];
      return;
    }

    const startDateOnly = isDateOnlyKey(startRaw.key, startRaw.value);
    const startDate = parseIcalDateValue(startRaw.value, startDateOnly);
    let endDate: Date;

    if (endRaw) {
      const endDateOnly = isDateOnlyKey(endRaw.key, endRaw.value);
      endDate = parseIcalDateValue(endRaw.value, endDateOnly);
    } else {
      endDate = new Date(startDate.getTime() + 24 * 60 * 60 * 1000);
    }

    if (endDate <= startDate) {
      endDate = new Date(startDate.getTime() + 24 * 60 * 60 * 1000);
    }

    events.push({ uid, startDate, endDate, summary });
    eventLines = [];
  };

  for (const line of lines) {
    const upper = line.trim().toUpperCase();
    if (upper === 'BEGIN:VEVENT') {
      inEvent = true;
      eventLines = [];
      continue;
    }
    if (upper === 'END:VEVENT') {
      inEvent = false;
      flush();
      continue;
    }
    if (!inEvent) continue;
    const parsed = parseRawLine(line);
    if (parsed) eventLines.push(parsed);
  }

  return events;
};

const pad = (value: number) => value.toString().padStart(2, '0');

export const formatIcalDate = (date: Date) => {
  const y = date.getUTCFullYear();
  const m = pad(date.getUTCMonth() + 1);
  const d = pad(date.getUTCDate());
  return `${y}${m}${d}`;
};

const escapeIcalText = (value: string) =>
  value.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');

export const buildIcal = (
  events: Array<{ uid: string; startDate: Date; endDate: Date; summary: string }>
) => {
  const rows: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//HOSTEA//Calendar Sync//ES',
    'CALSCALE:GREGORIAN'
  ];

  for (const event of events) {
    rows.push('BEGIN:VEVENT');
    rows.push(`UID:${escapeIcalText(event.uid)}`);
    rows.push(`DTSTAMP:${formatIcalDate(new Date())}T000000Z`);
    rows.push(`DTSTART;VALUE=DATE:${formatIcalDate(event.startDate)}`);
    rows.push(`DTEND;VALUE=DATE:${formatIcalDate(event.endDate)}`);
    rows.push(`SUMMARY:${escapeIcalText(event.summary)}`);
    rows.push('END:VEVENT');
  }

  rows.push('END:VCALENDAR');
  return rows.join('\r\n');
};
