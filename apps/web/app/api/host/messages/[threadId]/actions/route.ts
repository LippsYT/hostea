import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireSession } from '@/lib/permissions';
import { assertCsrf } from '@/lib/csrf';
import { z } from 'zod';
import { getIO } from '@/lib/socket';
import { calcBreakdown } from '@/lib/intelligent-pricing';
import { OfferStatus } from '@prisma/client';
import { sendPushToClient } from '@/lib/push-notifications';
import {
  approveReservationRequest,
  rejectReservationRequest
} from '@/lib/reservation-request-flow';

const schema = z.object({
  action: z.enum(['preapprove', 'offer', 'close', 'approve_request', 'reject_request']),
  offerTotal: z.coerce.number().optional(),
  offerHostNet: z.coerce.number().optional(),
  checkIn: z.string().optional(),
  checkOut: z.string().optional(),
  guestsCount: z.coerce.number().optional(),
  offerExpiresAt: z.string().optional()
});

export async function POST(req: Request, { params }: { params: { threadId: string } }) {
  assertCsrf(req);
  const session = await requireSession();
  const roles = (session.user as any).roles || [];
  if (!roles.includes('HOST') && !roles.includes('EXPERIENCE_HOST') && !roles.includes('ADMIN')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos invalidos' }, { status: 400 });
  }

  const userId = (session.user as any).id as string;
  const thread = await prisma.messageThread.findFirst({
    where: { id: params.threadId, participants: { some: { userId } } },
    include: {
      reservation: true,
      participants: true
    }
  });
  if (!thread) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }
  const counterpartyId = thread.participants.find((participant: { userId: string }) => participant.userId !== userId)?.userId || null;

  let status: string = thread.status;
  let messageBody = '';
  let offerTotal: number | null = null;
  let offerExpiresAt: Date | null = null;
  let offerHostNet: number | null = null;

  if (parsed.data.action === 'approve_request') {
    if (!thread.reservationId) {
      return NextResponse.json({ error: 'No hay solicitud asociada al chat' }, { status: 400 });
    }
    try {
      await approveReservationRequest(thread.reservationId, userId);
      return NextResponse.json({ ok: true });
    } catch (error: any) {
      const message = error?.message || 'No se pudo aprobar la solicitud';
      const code = message === 'No autorizado' ? 403 : message.includes('cupo') ? 409 : 400;
      return NextResponse.json({ error: message }, { status: code });
    }
  } else if (parsed.data.action === 'reject_request') {
    if (!thread.reservationId) {
      return NextResponse.json({ error: 'No hay solicitud asociada al chat' }, { status: 400 });
    }
    try {
      await rejectReservationRequest(thread.reservationId, userId);
      return NextResponse.json({ ok: true });
    } catch (error: any) {
      const message = error?.message || 'No se pudo rechazar la solicitud';
      const code = message === 'No autorizado' ? 403 : 400;
      return NextResponse.json({ error: message }, { status: code });
    }
  } else if (parsed.data.action === 'preapprove') {
    status = 'PREAPPROVED';
    messageBody = 'Te invitamos a reservar. Puedes completar la reserva con tus fechas.';
  } else if (parsed.data.action === 'offer') {
    const requestedTotal = Number(parsed.data.offerTotal || 0);
    if (!Number.isFinite(requestedTotal) || requestedTotal <= 0) {
      return NextResponse.json({ error: 'Monto de oferta invalido' }, { status: 400 });
    }
    const checkInInput = parsed.data.checkIn || (thread.reservation?.checkIn ? thread.reservation.checkIn.toISOString().slice(0, 10) : '');
    const checkOutInput = parsed.data.checkOut || (thread.reservation?.checkOut ? thread.reservation.checkOut.toISOString().slice(0, 10) : '');
    if (!checkInInput || !checkOutInput) {
      return NextResponse.json(
        { error: 'La oferta especial requiere fecha de entrada y salida' },
        { status: 400 }
      );
    }
    const checkIn = new Date(checkInInput);
    const checkOut = new Date(checkOutInput);
    if (Number.isNaN(checkIn.getTime()) || Number.isNaN(checkOut.getTime()) || checkOut <= checkIn) {
      return NextResponse.json({ error: 'Rango de fechas invalido' }, { status: 400 });
    }

    const listingId =
      thread.reservation?.listingId ||
      (thread.subject?.startsWith('LISTING:') ? thread.subject.replace('LISTING:', '').trim() : null);
    if (!listingId) {
      return NextResponse.json(
        { error: 'No se pudo identificar la propiedad para la oferta' },
        { status: 400 }
      );
    }

    const guestParticipant = thread.participants.find((participant: { userId: string }) => participant.userId !== userId);
    if (!guestParticipant?.userId) {
      return NextResponse.json({ error: 'No se pudo identificar al cliente de la conversacion' }, { status: 400 });
    }

    const guestsCount = Math.max(
      1,
      Number(parsed.data.guestsCount) || thread.reservation?.guestsCount || 1
    );
    status = 'OFFER';
    offerTotal = requestedTotal;
    offerHostNet = Number(parsed.data.offerHostNet || 0) || null;
    const expiresInput = parsed.data.offerExpiresAt ? new Date(parsed.data.offerExpiresAt) : null;
    if (expiresInput && Number.isNaN(expiresInput.getTime())) {
      return NextResponse.json({ error: 'Fecha de vencimiento invalida' }, { status: 400 });
    }
    offerExpiresAt = expiresInput || new Date(Date.now() + 48 * 60 * 60 * 1000);
    const breakdown = calcBreakdown(offerTotal);

    await prisma.offer.updateMany({
      where: { threadId: thread.id, status: OfferStatus.PENDING },
      data: { status: OfferStatus.EXPIRED }
    });

    await prisma.offer.create({
      data: {
        threadId: thread.id,
        listingId,
        hostId: userId,
        guestId: guestParticipant.userId,
        checkIn,
        checkOut,
        guestsCount,
        hostNet: offerHostNet || breakdown.hostNet,
        adminCharges: breakdown.stripeFee,
        serviceFee: breakdown.platformFee,
        clientTotal: offerTotal,
        currency: 'USD',
        expiresAt: offerExpiresAt
      }
    });

    const expiryLabel = offerExpiresAt.toLocaleDateString('es-AR');
    messageBody = `Oferta especial enviada: USD ${offerTotal.toFixed(
      2
    )}. Valida hasta ${expiryLabel}. Para confirmar, acepta y paga desde la plataforma.`;
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

  if (counterpartyId) {
    if (parsed.data.action === 'offer') {
      await sendPushToClient(counterpartyId, {
        title: 'Nueva oferta especial',
        body: messageBody,
        url: `/dashboard/client/messages?threadId=${thread.id}`,
        type: 'NEW_OFFER'
      });
    } else if (parsed.data.action === 'preapprove') {
      await sendPushToClient(counterpartyId, {
        title: 'Invitacion a reservar',
        body: 'El anfitrion te invito a reservar desde la plataforma.',
        url: `/dashboard/client/messages?threadId=${thread.id}`,
        type: 'INVITE_TO_BOOK'
      });
    }
  }

  return NextResponse.json({ ok: true });
}

