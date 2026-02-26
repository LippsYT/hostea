import { NextResponse } from 'next/server';
import { z } from 'zod';
import { assertCsrf } from '@/lib/csrf';
import { prisma } from '@/lib/db';
import { requireSession } from '@/lib/permissions';
import { rateLimit } from '@/lib/rate-limit';

const schema = z.object({
  offerId: z.string()
});

export async function POST(
  req: Request,
  { params }: { params: { threadId: string } }
) {
  try {
    assertCsrf(req);
    const session = await requireSession();
    const userId = (session.user as any).id as string;
    const ok = await rateLimit(`offer:reject:${userId}`, 20, 60);
    if (!ok) return NextResponse.json({ error: 'Rate limit' }, { status: 429 });

    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Datos invalidos' }, { status: 400 });
    }

    const thread = await prisma.messageThread.findFirst({
      where: {
        id: params.threadId,
        participants: { some: { userId } }
      }
    });
    if (!thread) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const offer = await prisma.offer.findFirst({
      where: {
        id: parsed.data.offerId,
        threadId: thread.id,
        guestId: userId,
        status: { in: ['PENDING', 'ACCEPTED'] }
      }
    });
    if (!offer) {
      return NextResponse.json({ error: 'Oferta no disponible para rechazar' }, { status: 400 });
    }

    await prisma.offer.update({
      where: { id: offer.id },
      data: { status: 'REJECTED' }
    });

    await prisma.messageThread.update({
      where: { id: thread.id },
      data: {
        status: 'INQUIRY',
        offerTotal: null,
        offerCurrency: null,
        offerExpiresAt: null
      }
    });

    await prisma.calendarBlock.deleteMany({
      where: { listingId: offer.listingId, createdBy: `offer:${offer.id}` }
    });

    await prisma.message.create({
      data: {
        threadId: thread.id,
        senderId: userId,
        body: 'Oferta rechazada.'
      }
    });

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Error' }, { status: 500 });
  }
}
