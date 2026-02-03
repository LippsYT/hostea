import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireSession } from '@/lib/permissions';
import { assertCsrf } from '@/lib/csrf';
import { z } from 'zod';
import { getIO } from '@/lib/socket';

const schema = z.object({
  action: z.enum(['preapprove', 'offer', 'reject']),
  offerTotal: z.coerce.number().optional(),
  offerExpiresAt: z.string().optional()
});

export async function POST(req: Request, { params }: { params: { threadId: string } }) {
  assertCsrf(req);
  const session = await requireSession();
  const roles = (session.user as any).roles || [];
  if (!roles.includes('HOST') && !roles.includes('ADMIN')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos invalidos' }, { status: 400 });
  }

  const thread = await prisma.messageThread.findFirst({
    where: { id: params.threadId, participants: { some: { userId: (session.user as any).id } } }
  });
  if (!thread) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  let status: string = thread.status;
  let messageBody = '';
  let offerTotal: number | null = null;
  let offerExpiresAt: Date | null = null;

  if (parsed.data.action === 'preapprove') {
    status = 'PREAPPROVED';
    messageBody = 'Preaprobado: podes reservar cuando quieras con tus fechas.';
  }
  if (parsed.data.action === 'offer') {
    status = 'OFFER';
    offerTotal = parsed.data.offerTotal || null;
    offerExpiresAt = parsed.data.offerExpiresAt ? new Date(parsed.data.offerExpiresAt) : null;
    messageBody = offerTotal
      ? `Oferta especial: USD ${offerTotal.toFixed(2)}. Reservá desde la plataforma para confirmar.`
      : 'Oferta especial disponible. Reservá desde la plataforma para confirmar.';
  }
  if (parsed.data.action === 'reject') {
    status = 'REJECTED';
    messageBody = 'Lo sentimos, no podemos aceptar esta solicitud en estas fechas.';
  }

  await prisma.messageThread.update({
    where: { id: thread.id },
    data: {
      status: status as any,
      offerTotal,
      offerCurrency: offerTotal ? 'USD' : null,
      offerExpiresAt
    }
  });

  const message = await prisma.message.create({
    data: {
      threadId: thread.id,
      senderId: (session.user as any).id,
      body: messageBody
    }
  });

  const sender = await prisma.user.findUnique({
    where: { id: (session.user as any).id },
    include: { profile: true }
  });

  const payload = {
    id: message.id,
    body: message.body,
    createdAt: message.createdAt,
    senderId: message.senderId,
    senderName: sender?.profile?.name || sender?.email || 'Usuario'
  };

  try {
    const io = getIO();
    io.to(`thread:${thread.id}`).emit('message:new', payload);
  } catch {}

  return NextResponse.json({ ok: true });
}
