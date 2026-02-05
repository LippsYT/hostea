import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireSession } from '@/lib/permissions';
import { assertCsrf } from '@/lib/csrf';
import { rateLimit } from '@/lib/rate-limit';

export async function GET() {
  try {
    const session = await requireSession();
    const userId = (session.user as any).id;
    const threads = await prisma.messageThread.findMany({
      where: { participants: { some: { userId } } },
      include: { reservation: { include: { listing: true } } },
      orderBy: { createdAt: 'desc' }
    });
    return NextResponse.json({ threads });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    assertCsrf(req);
    const session = await requireSession();
    const ok = await rateLimit(`thread:${(session.user as any).id}`, 10, 60);
    if (!ok) return NextResponse.json({ error: 'Rate limit' }, { status: 429 });
    const body = await req.json();
    const reservationId = body.reservationId as string | undefined;

    let hostId: string | null = null;
    if (reservationId) {
      const reservation = await prisma.reservation.findUnique({
        where: { id: reservationId },
        include: { listing: true }
      });
      hostId = reservation?.listing.hostId || null;
    }

    const participants: { userId: string }[] = [{ userId: (session.user as any).id }];
    if (hostId && hostId !== (session.user as any).id) {
      participants.push({ userId: hostId });
    }

    if (reservationId) {
      const existing = await prisma.messageThread.findUnique({
        where: { reservationId }
      });

      if (existing) {
        const userId = (session.user as any).id;
        const participant = await prisma.messageThreadParticipant.findUnique({
          where: { threadId_userId: { threadId: existing.id, userId } }
        });
        if (!participant) {
          await prisma.messageThreadParticipant.create({
            data: { threadId: existing.id, userId }
          });
        }
        return NextResponse.json({ thread: existing });
      }
    }

    try {
      const thread = await prisma.messageThread.create({
        data: {
          reservationId,
          status: reservationId ? 'RESERVATION' : 'INQUIRY',
          createdById: (session.user as any).id,
          participants: { create: participants }
        }
      });
      return NextResponse.json({ thread });
    } catch (error: any) {
      if (error?.code === 'P2002' && reservationId) {
        const existing = await prisma.messageThread.findUnique({
          where: { reservationId }
        });
        if (existing) {
          return NextResponse.json({ thread: existing });
        }
      }
      throw error;
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Error' }, { status: 500 });
  }
}
