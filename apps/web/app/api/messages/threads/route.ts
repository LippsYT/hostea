import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireSession } from '@/lib/permissions';
import { assertCsrf } from '@/lib/csrf';
import { rateLimit } from '@/lib/rate-limit';
import { sendPushToHost } from '@/lib/push-notifications';
import { expireAwaitingPaymentReservations } from '@/lib/reservation-request-flow';

const unauthorized = (message = 'No autorizado') =>
  NextResponse.json({ error: message }, { status: 401 });

export async function GET() {
  try {
    await expireAwaitingPaymentReservations();
    const session = await requireSession();
    const userId = (session.user as any).id;
    const threads = await prisma.messageThread.findMany({
      where: { participants: { some: { userId } } },
      include: { reservation: { include: { listing: true } } },
      orderBy: { createdAt: 'desc' }
    });
    return NextResponse.json({ threads });
  } catch (error: any) {
    if (error?.message === 'No autorizado') {
      return unauthorized();
    }
    return NextResponse.json({ error: error.message || 'Error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await expireAwaitingPaymentReservations();
    assertCsrf(req);
    const session = await requireSession();
    const userId = (session.user as any).id as string;
    const ok = await rateLimit(`thread:${userId}`, 10, 60);
    if (!ok) {
      return NextResponse.json({ error: 'Rate limit' }, { status: 429 });
    }

    const body = await req.json();
    const reservationId = body.reservationId as string | undefined;
    const listingId = body.listingId as string | undefined;

    if (!reservationId && !listingId) {
      return NextResponse.json({ error: 'Debe indicar reserva o propiedad' }, { status: 400 });
    }

    let hostId: string | null = null;
    let subject: string | null = null;
    if (reservationId) {
      const reservation = await prisma.reservation.findUnique({
        where: { id: reservationId },
        include: { listing: true }
      });
      hostId = reservation?.listing.hostId || null;
      subject = reservation?.listing.title || null;
    } else if (listingId) {
      const listing = await prisma.listing.findUnique({ where: { id: listingId } });
      hostId = listing?.hostId || null;
      subject = listing?.title || null;
    }

    if (!hostId) {
      return NextResponse.json({ error: 'No se encontro el anfitrion' }, { status: 404 });
    }
    if (hostId === userId) {
      return NextResponse.json({ error: 'No puedes abrir chat con tu propio anuncio' }, { status: 400 });
    }

    if (reservationId) {
      const existingReservationThread = await prisma.messageThread.findUnique({
        where: { reservationId }
      });
      if (existingReservationThread) {
        const participant = await prisma.messageThreadParticipant.findUnique({
          where: { threadId_userId: { threadId: existingReservationThread.id, userId } }
        });
        if (!participant) {
          await prisma.messageThreadParticipant.create({
            data: { threadId: existingReservationThread.id, userId }
          });
        }
        return NextResponse.json({ thread: existingReservationThread });
      }
    }

    if (!reservationId && listingId) {
      const existingInquiry = await prisma.messageThread.findFirst({
        where: {
          reservationId: null,
          createdById: userId,
          subject: `LISTING:${listingId}`,
          participants: { some: { userId: hostId } }
        }
      });
      if (existingInquiry) {
        return NextResponse.json({ thread: existingInquiry });
      }
    }

    const participants: { userId: string }[] = [{ userId }, { userId: hostId }];

    try {
      const thread = await prisma.messageThread.create({
        data: {
          reservationId,
          status: reservationId ? 'RESERVATION' : 'INQUIRY',
          subject: reservationId ? subject : `LISTING:${listingId || ''}`,
          createdById: userId,
          participants: { create: participants }
        }
      });
      if (!reservationId && listingId) {
        try {
          await sendPushToHost(hostId, {
            title: 'Nueva consulta',
            body: `Tienes una nueva consulta en ${subject || 'tu propiedad'}.`,
            url: `/dashboard/host/messages?threadId=${thread.id}`,
            type: 'NEW_INQUIRY'
          });
        } catch {
          // La conversación no debe fallar por un error de push.
        }
      }
      return NextResponse.json({ thread });
    } catch (error: any) {
      if (error?.code === 'P2002' && reservationId) {
        const existingThread = await prisma.messageThread.findUnique({
          where: { reservationId }
        });
        if (existingThread) {
          return NextResponse.json({ thread: existingThread });
        }
      }
      throw error;
    }
  } catch (error: any) {
    if (error?.message === 'No autorizado') {
      return unauthorized();
    }
    if (error?.message === 'CSRF token invalido') {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: error.message || 'Error' }, { status: 500 });
  }
}
