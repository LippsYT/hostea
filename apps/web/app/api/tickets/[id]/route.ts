import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireSession } from '@/lib/permissions';
import { assertCsrf } from '@/lib/csrf';
import { z } from 'zod';
import { TicketStatus } from '@prisma/client';
import { formatSupportCaseNumber, ticketStatusLabel } from '@/lib/support';

const schema = z.object({
  message: z.string().min(0).optional(),
  status: z.nativeEnum(TicketStatus).optional()
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    assertCsrf(req);
    const session = await requireSession();
    const roles = (session.user as any).roles as string[];
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: 'Datos invalidos' }, { status: 400 });

    const ticket = await prisma.ticket.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        createdById: true,
        subject: true,
        status: true,
        priority: true,
        createdAt: true,
        updatedAt: true
      }
    });
    if (!ticket) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
    const isOwner = ticket.createdById === (session.user as any).id;
    const isOperator =
      roles.includes('SUPPORT') || roles.includes('ADMIN') || roles.includes('MODERATOR');
    const canReply = isOwner || isOperator;
    if (!canReply) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

    const message = parsed.data.message?.trim();
    const requestedStatus = parsed.data.status;
    const nextStatus =
      requestedStatus ||
      (message && isOperator && ticket.status === 'OPEN'
        ? 'IN_REVIEW'
        : message && !isOperator && ticket.status === 'WAITING_FOR_USER'
          ? 'IN_REVIEW'
          : undefined);

    const supportUsers = !isOperator
      ? await prisma.user.findMany({
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
        }).catch(() => [])
      : [];

    const updatedTicket = await prisma.$transaction(async (tx) => {
      if (nextStatus) {
        await tx.ticket.update({
          where: { id: params.id },
          data: {
            status: nextStatus
          }
        }).catch(() => undefined);
      }

      if (message) {
        await tx.ticketMessage.create({
          data: {
            ticketId: params.id,
            senderId: (session.user as any).id,
            body: message
          }
        });
      }

      const caseNumber = formatSupportCaseNumber((ticket as any).caseSequence ?? null);

      if (isOperator) {
        if (message) {
          await tx.notification.create({
            data: {
              userId: ticket.createdById,
              kind: 'INFO',
              title: `Nueva respuesta en ${caseNumber}`,
              body: message,
              link: '/dashboard/client'
            }
          }).catch(() => undefined);
        }

        if (nextStatus && nextStatus !== ticket.status) {
          await tx.notification.create({
            data: {
              userId: ticket.createdById,
              kind: nextStatus === 'CLOSED' ? 'SUCCESS' : 'INFO',
              title: `Estado actualizado en ${caseNumber}`,
              body:
                nextStatus === 'CLOSED' && message
                  ? `Caso cerrado. Resumen: ${message}`
                  : `Tu caso ahora esta ${ticketStatusLabel(nextStatus).toLowerCase()}.`,
              link: '/dashboard/client'
            }
          }).catch(() => undefined);
        }
      } else if (message && supportUsers.length > 0) {
        await tx.notification.createMany({
          data: supportUsers.map((user) => ({
            userId: user.id,
            kind: 'INFO',
            title: `Respuesta del usuario en ${caseNumber}`,
            body: message,
            link: '/dashboard/support'
          }))
        }).catch(() => undefined);
      }

      return tx.ticket.findUnique({
        where: { id: params.id },
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
    });

    return NextResponse.json({
      ticket: updatedTicket
        ? {
            ...updatedTicket,
            caseSequence: (updatedTicket as any).caseSequence ?? null,
            summary: (updatedTicket as any).summary ?? null
          }
        : null
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'No autorizado' }, { status: 401 });
  }
}
