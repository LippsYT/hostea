import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireSession } from '@/lib/permissions';
import { assertCsrf } from '@/lib/csrf';

const bankKey = (userId: string) => `hostBankAccount:${userId}`;

export async function GET() {
  const session = await requireSession();
  const userId = (session.user as any).id as string;
  const row = await prisma.settings.findUnique({ where: { key: bankKey(userId) } });
  return NextResponse.json({ bankAccount: row?.value || null });
}

export async function POST(req: Request) {
  assertCsrf(req);
  const session = await requireSession();
  const userId = (session.user as any).id as string;
  const body = await req.json();
  const safeValue = JSON.parse(JSON.stringify(body));

  await prisma.settings.upsert({
    where: { key: bankKey(userId) },
    update: { value: safeValue },
    create: { key: bankKey(userId), value: safeValue }
  });

  return NextResponse.json({ ok: true });
}
