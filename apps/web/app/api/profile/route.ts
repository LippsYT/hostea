import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireSession } from '@/lib/permissions';
import { assertCsrf } from '@/lib/csrf';
import { z } from 'zod';

const schema = z.object({
  name: z.string().min(2),
  phone: z.string().optional()
});

export async function GET() {
  const session = await requireSession();
  const profile = await prisma.profile.findUnique({ where: { userId: (session.user as any).id } });
  return NextResponse.json({ profile });
}

export async function POST(req: Request) {
  assertCsrf(req);
  const session = await requireSession();
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Datos invalidos' }, { status: 400 });

  const profile = await prisma.profile.upsert({
    where: { userId: (session.user as any).id },
    update: { name: parsed.data.name, phone: parsed.data.phone },
    create: { userId: (session.user as any).id, name: parsed.data.name, phone: parsed.data.phone }
  });
  return NextResponse.json({ profile });
}
