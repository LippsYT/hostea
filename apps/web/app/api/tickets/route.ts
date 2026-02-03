import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireSession } from '@/lib/permissions';
import { assertCsrf } from '@/lib/csrf';
import { z } from 'zod';
import { rateLimit } from '@/lib/rate-limit';

const schema = z.object({
  subject: z.string().min(3),
  message: z.string().min(5)
});

export async function GET() {
  const session = await requireSession();
  const roles = ((session.user as any).roles || []) as string[];
  const where = roles.includes('SUPPORT') || roles.includes('MODERATOR') || roles.includes('ADMIN')
    ? {}
    : { createdById: (session.user as any).id };

  const tickets = await prisma.ticket.findMany({
    where,
    include: { messages: true },
    orderBy: { createdAt: 'desc' }
  });
  return NextResponse.json({ tickets });
}

export async function POST(req: Request) {
  assertCsrf(req);
  const session = await requireSession();
  const ok = await rateLimit(`tickets:${(session.user as any).id}`, 10, 60);
  if (!ok) return NextResponse.json({ error: 'Rate limit' }, { status: 429 });
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos invalidos' }, { status: 400 });
  }
  const ticket = await prisma.ticket.create({
    data: {
      createdById: (session.user as any).id,
      subject: parsed.data.subject,
      messages: {
        create: {
          senderId: (session.user as any).id,
          body: parsed.data.message
        }
      }
    },
    include: { messages: true }
  });
  return NextResponse.json({ ticket });
}
