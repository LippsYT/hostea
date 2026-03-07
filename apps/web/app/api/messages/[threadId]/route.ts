import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireSession } from '@/lib/permissions';
import { assertCsrf } from '@/lib/csrf';
import { getIO } from '@/lib/socket';
import { rateLimit } from '@/lib/rate-limit';
import { sendPushToUser } from '@/lib/push-notifications';
import { expireAwaitingPaymentReservations } from '@/lib/reservation-request-flow';

export async function GET(_req: Request, { params }: { params: { threadId: string } }) {
  await expireAwaitingPaymentReservations();
  const session = await requireSession();
  const userId = (session.user as any).id;
  const thread = await prisma.messageThread.findFirst({
    where: { id: params.threadId, participants: { some: { userId } } }
  });
  if (!thread) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  const isAssociated =
    Boolean(thread.reservationId) ||
    Boolean(thread.subject?.startsWith('LISTING:')) ||
    Boolean(thread.subject?.startsWith('ACTIVITY:'));
  if (!isAssociated) {
    return NextResponse.json({ error: 'Este chat no tiene consulta o reserva asociada' }, { status: 400 });
  }

  await prisma.message.updateMany({
    where: {
      threadId: params.threadId,
      senderId: { not: userId },
      seenAt: null
    },
    data: { seenAt: new Date() }
  });

  const messages = await prisma.message.findMany({
    where: { threadId: params.threadId },
    orderBy: { createdAt: 'asc' },
    include: { sender: { include: { profile: true } } }
  });

  const safe = messages.map((m) => ({
    id: m.id,
    body: m.body,
    createdAt: m.createdAt,
    seenAt: m.seenAt,
    senderId: m.senderId,
    senderName: m.sender.profile?.name || m.sender.email
  }));

  return NextResponse.json({ messages: safe });
}

export async function POST(req: Request, { params }: { params: { threadId: string } }) {
  await expireAwaitingPaymentReservations();
  assertCsrf(req);
  const session = await requireSession();
  const userId = (session.user as any).id;
  const ok = await rateLimit(`message:${userId}`, 30, 60);
  if (!ok) return NextResponse.json({ error: 'Rate limit' }, { status: 429 });
  const body = await req.json();
  if (!body.body || typeof body.body !== 'string') {
    return NextResponse.json({ error: 'Mensaje invalido' }, { status: 400 });
  }
  const thread = await prisma.messageThread.findFirst({
    where: { id: params.threadId, participants: { some: { userId } } }
  });
  if (!thread) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  const isAssociated =
    Boolean(thread.reservationId) ||
    Boolean(thread.subject?.startsWith('LISTING:')) ||
    Boolean(thread.subject?.startsWith('ACTIVITY:'));
  if (!isAssociated) {
    return NextResponse.json({ error: 'Este chat no tiene consulta o reserva asociada' }, { status: 400 });
  }

  const message = await prisma.message.create({
    data: {
      threadId: params.threadId,
      senderId: userId,
      body: body.body
    }
  });

  const sender = await prisma.user.findUnique({
    where: { id: userId },
    include: { profile: true }
  });

  const payload = {
    id: message.id,
    body: message.body,
    createdAt: message.createdAt,
    seenAt: message.seenAt,
    senderId: message.senderId,
    senderName: sender?.profile?.name || sender?.email || 'Usuario'
  };

  try {
    const io = getIO();
    io.to(`thread:${params.threadId}`).emit('message:new', payload);
  } catch {}

  const participants = await prisma.messageThreadParticipant.findMany({
    where: {
      threadId: params.threadId,
      userId: { not: userId }
    },
    include: {
      user: {
        include: {
          roles: { include: { role: true } }
        }
      }
    }
  });

  for (const recipient of participants) {
    const roleNames = recipient.user.roles.map((roleRow) => roleRow.role.name);
    const targetRole = roleNames.includes('HOST') || roleNames.includes('ADMIN') ? 'host' : 'client';
    const targetUrl =
      targetRole === 'host'
        ? `/dashboard/host/messages?threadId=${params.threadId}`
        : `/dashboard/client/messages?threadId=${params.threadId}`;

    await sendPushToUser(recipient.userId, targetRole, {
      title: 'Nuevo mensaje',
      body: `${payload.senderName}: ${payload.body.slice(0, 120)}`,
      url: targetUrl,
      type: 'NEW_MESSAGE'
    });
  }

  return NextResponse.json({ message: payload });
}
