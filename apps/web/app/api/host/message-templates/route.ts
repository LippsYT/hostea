import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireSession } from '@/lib/permissions';
import { assertCsrf } from '@/lib/csrf';

const settingsKey = (userId: string) => `hostMessageTemplates:${userId}`;

export async function GET() {
  const session = await requireSession();
  const userId = (session.user as any).id as string;
  const row = await prisma.settings.findUnique({ where: { key: settingsKey(userId) } });
  return NextResponse.json({ templates: row?.value || null });
}

export async function POST(req: Request) {
  assertCsrf(req);
  const session = await requireSession();
  const userId = (session.user as any).id as string;
  const body = await req.json();
  const safeValue = JSON.parse(JSON.stringify(body));

  await prisma.settings.upsert({
    where: { key: settingsKey(userId) },
    update: { value: safeValue },
    create: { key: settingsKey(userId), value: safeValue }
  });

  return NextResponse.json({ ok: true });
}
