import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireSession } from '@/lib/permissions';
import { assertCsrf } from '@/lib/csrf';
import { z } from 'zod';
import { getIO } from '@/lib/socket';

const schema = z.object({
  action: z.enum(['preapprove', 'offer', 'close']),
  offerTotal: z.coerce.number().optional(),
  offerHostNet: z.coerce.number().optional(),
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

  const userId = (session.user as any).id as string;
  const thread = await prisma.messageThread.findFirst({
    where: { id: params.threadId, participants: { some: { userId } } }
  });
  if (!thread) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  let status: string = thread.status;
  let messageBody = '';
  let offerTotal: number | null = null;
  let offerExpiresAt: Date | null = null;
  let offerHostNet: number | null = null;

  if (parsed.data.action === 'preapprove') {
    status = 'PREAPPROVED';
    messageBody = 'Te invitamos a reservar. Puedes completar la reserva con tus fechas.';
  } else if (parsed.data.action === 'offer') {
    const requestedTotal = Number(parsed.data.offerTotal || 0);
    if (!Number.isFinite(requestedTotal) || requestedTotal <= 0) {
      return NextResponse.json({ error: 'Monto de oferta invalido' }, { status: 400 });
    }
    status = 'OFFER';
    offerTotal = requestedTotal;
    offerHostNet = Number(parsed.data.offerHostNet || 0) || null;
    const expiresInput = parsed.data.offerExpiresAt ? new Date(parsed.data.offerExpiresAt) : null;
    if (expiresInput && Number.isNaN(expiresInput.getTime())) {
      return NextResponse.json({ error: 'Fecha de vencimiento invalida' }, { status: 400 });
    }
    offerExpiresAt = expiresInput || new Date(Date.now() + 48 * 60 * 60 * 1000);
    messageBody = `Oferta especial enviada por USD ${offerTotal.toFixed(2)}. Acepta y paga desde la plataforma para confirmar.`;
    if (offerHostNet && offerHostNet > 0) {
      messageBody += ` Neto anfitrion: USD ${offerHostNet.toFixed(2)}.`;
    }
  } else if (parsed.data.action === 'close') {
    status = thread.reservationId ? thread.status : 'REJECTED';
    messageBody = 'Conversacion cerrada por el anfitrion.';
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
      senderId: userId,
      body: messageBody
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
    io.to(`thread:${thread.id}`).emit('message:new', payload);
  } catch {}

  return NextResponse.json({ ok: true });
}
