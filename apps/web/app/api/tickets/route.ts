import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireSession } from '@/lib/permissions';
import { assertCsrf } from '@/lib/csrf';
import { TicketPriority } from '@prisma/client';
import { z } from 'zod';
import { rateLimit } from '@/lib/rate-limit';
import { formatSupportCaseNumber } from '@/lib/support';

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
  try {
    const session = await requireSession();
    const roles = ((session.user as any).roles || []) as string[];
    const where = roles.includes('SUPPORT') || roles.includes('MODERATOR') || roles.includes('ADMIN')
      ? {}
      : { createdById: (session.user as any).id };

    const tickets = await prisma.ticket.findMany({
      where,
      select: {
        id: true,
        subject: true,
        status: true,
        priority: true,
        createdAt: true,
        updatedAt: true,
        createdBy: { include: { profile: true } },
        messages: {
          include: { sender: { include: { profile: true } } },
          orderBy: { createdAt: 'asc' }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const normalizedTickets = tickets.map((ticket) => ({
      ...ticket,
      caseSequence: null,
      summary: null
    }));
    return NextResponse.json({ tickets: normalizedTickets });
  } catch (error: any) {
    return NextResponse.json({ tickets: [], error: error?.message || 'No autorizado' }, { status: 200 });
  }
}

export async function POST(req: Request) {
  try {
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
    const creatorId = (session.user as any).id as string;
    const supportUsers = await prisma.user.findMany({
      where: {
        roles: {
          some: {
            role: {
              name: { in: ['ADMIN', 'SUPPORT', 'MODERATOR'] }
            }
          }
        }
      },
      select: { id: true }
    }).catch(() => []);

    const ticket = await prisma.$transaction(async (tx) => {
      const createdTicket = await tx.ticket.create({
        data: {
          createdById: creatorId,
          subject: subjectParts.join(' '),
          priority,
          messages: {
            create: {
              senderId: creatorId,
              body: parsed.data.message
            }
          }
        },
        select: {
          id: true,
          subject: true,
          status: true,
          priority: true,
          createdAt: true,
          updatedAt: true,
          createdBy: { include: { profile: true } },
          messages: {
            include: { sender: { include: { profile: true } } },
            orderBy: { createdAt: 'asc' }
          }
        }
      });

      const caseNumber = formatSupportCaseNumber((createdTicket as any).caseSequence ?? null);
      await tx.notification.create({
        data: {
          userId: creatorId,
          kind: 'SUCCESS',
          title: `Caso ${caseNumber} creado`,
          body: 'Soporte recibio tu solicitud y ya puede seguir el caso.',
          link: '/dashboard/client'
        }
      }).catch(() => undefined);

      if (supportUsers.length > 0) {
        await tx.notification.createMany({
          data: supportUsers.map((user) => ({
            userId: user.id,
            kind: priority === 'URGENT' ? 'WARNING' : 'INFO',
            title: `Nuevo ticket ${caseNumber}`,
            body: createdTicket.subject,
            link: '/dashboard/support'
          }))
        }).catch(() => undefined);
      }

      return {
        ...createdTicket,
        caseSequence: (createdTicket as any).caseSequence ?? null,
        summary: (createdTicket as any).summary ?? null
      };
    });
    return NextResponse.json({ ticket });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'No autorizado' }, { status: 401 });
  }
}
