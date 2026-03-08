import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/permissions';
import { assertCsrf } from '@/lib/csrf';

type Entry = { key: string; value: unknown };

const normalizePayload = (raw: unknown): Entry[] => {
  if (Array.isArray(raw)) {
    return raw
      .filter((item): item is Entry => Boolean(item && typeof item === 'object'))
      .filter((item) => typeof item.key === 'string');
  }
  if (raw && typeof raw === 'object') {
    return Object.entries(raw as Record<string, unknown>).map(([key, value]) => ({ key, value }));
  }
  return [];
};

export async function POST(req: NextRequest) {
  try {
    assertCsrf(req);
    await requireRole('ADMIN');
    const body = await req.json();
    const entries = normalizePayload(body);
    if (entries.length === 0) {
      return NextResponse.json({ error: 'Payload invalido' }, { status: 400 });
    }

    for (const { key, value } of entries) {
      const safeValue = JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
      await prisma.settings.upsert({
        where: { key },
        update: { value: safeValue },
        create: { key, value: safeValue }
      });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Error' }, { status: 500 });
  }
}
