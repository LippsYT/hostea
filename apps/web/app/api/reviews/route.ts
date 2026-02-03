import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireSession } from '@/lib/permissions';
import { assertCsrf } from '@/lib/csrf';
import { z } from 'zod';
import { ReservationStatus } from '@prisma/client';

const schema = z.object({
  reservationId: z.string(),
  rating: z.number().min(1).max(5),
  comment: z.string().optional()
});

export async function POST(req: Request) {
  assertCsrf(req);
  const session = await requireSession();
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Datos invalidos' }, { status: 400 });

  const reservation = await prisma.reservation.findUnique({
    where: { id: parsed.data.reservationId },
    include: { listing: true }
  });
  if (!reservation || reservation.userId !== (session.user as any).id) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }
  if (reservation.status !== ReservationStatus.COMPLETED) {
    return NextResponse.json({ error: 'Reserva no completada' }, { status: 400 });
  }

  const review = await prisma.review.create({
    data: {
      reservationId: reservation.id,
      reviewerId: reservation.userId,
      listingId: reservation.listingId,
      rating: parsed.data.rating,
      comment: parsed.data.comment
    }
  });
  return NextResponse.json({ review });
}
