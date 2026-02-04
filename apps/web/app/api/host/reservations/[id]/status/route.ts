import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireSession } from '@/lib/permissions';
import { assertCsrf } from '@/lib/csrf';
import { z } from 'zod';
import { ReservationStatus } from '@prisma/client';
import { sendAutoMessagesOnConfirm } from '@/lib/auto-messages';

const schema = z.object({
  status: z.nativeEnum(ReservationStatus)
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  assertCsrf(req);
  const session = await requireSession();
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Datos invalidos' }, { status: 400 });

  const reservation = await prisma.reservation.findUnique({
    where: { id: params.id },
    include: { listing: true }
  });
  if (!reservation) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
  if (reservation.listing.hostId !== (session.user as any).id) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const updated = await prisma.reservation.update({
    where: { id: reservation.id },
    data: { status: parsed.data.status }
  });
  if (parsed.data.status === ReservationStatus.CONFIRMED) {
    await sendAutoMessagesOnConfirm(reservation.id);
  }
  return NextResponse.json({ reservation: updated });
}
