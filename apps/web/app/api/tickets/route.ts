import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireSession } from '@/lib/permissions';
import { assertCsrf } from '@/lib/csrf';
import { TicketPriority } from '@prisma/client';
import { z } from 'zod';
import { rateLimit } from '@/lib/rate-limit';

const schema = z.object({
  subject: z.string().min(3),
  message: z.string().min(5),
  category: z.string().optional(),
  reference: z.string().optional(),
  priority: z.nativeEnum(TicketPriority).optional()
});

const inferPriority = (message: string, requested?: TicketPriority) => {
  if (requested) return requested;
  const normalized = message.toLowerCase();
  if (
    normalized.includes('no puedo entrar') ||
    normalized.includes('me cobraron dos veces') ||
    normalized.includes('la propiedad no existe') ||
    normalized.includes('seguridad')
  ) {
    return TicketPriority.URGENT;
  }
  if (
    normalized.includes('check-in hoy') ||
    normalized.includes('hoy') ||
    normalized.includes('manana') ||
    normalized.includes('anfitrion no responde')
  ) {
    return TicketPriority.HIGH;
  }
  return TicketPriority.MEDIUM;
};

export async function GET() {
  const session = await requireSession();
  const roles = ((session.user as any).roles || []) as string[];
  const where = roles.includes('SUPPORT') || roles.includes('MODERATOR') || roles.includes('ADMIN')
    ? {}
    : { createdById: (session.user as any).id };

  const tickets = await prisma.ticket.findMany({
    where,
    include: {
      createdBy: { include: { profile: true } },
      messages: {
        include: { sender: { include: { profile: true } } },
        orderBy: { createdAt: 'asc' }
      }
    },
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
  const priority = inferPriority(parsed.data.message, parsed.data.priority);
  const subjectParts = [
    parsed.data.category?.trim() ? `[${parsed.data.category.trim()}]` : '',
    parsed.data.reference?.trim() ? `[${parsed.data.reference.trim()}]` : '',
    parsed.data.subject.trim()
  ].filter(Boolean);
  const ticket = await prisma.ticket.create({
    data: {
      createdById: (session.user as any).id,
      subject: subjectParts.join(' '),
      priority,
      messages: {
        create: {
          senderId: (session.user as any).id,
          body: parsed.data.message
        }
      }
    },
    include: {
      createdBy: { include: { profile: true } },
      messages: {
        include: { sender: { include: { profile: true } } },
        orderBy: { createdAt: 'asc' }
      }
    }
  });
  return NextResponse.json({ ticket });
}
