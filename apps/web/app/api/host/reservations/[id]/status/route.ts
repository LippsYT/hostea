import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireSession } from '@/lib/permissions';
import { assertCsrf } from '@/lib/csrf';
import { z } from 'zod';
import { ReservationStatus } from '@prisma/client';
import {
  expireAwaitingPaymentReservations,
  approveReservationRequest,
  rejectReservationRequest
} from '@/lib/reservation-request-flow';

const schema = z.object({
  status: z.nativeEnum(ReservationStatus),
  reason: z.string().max(240).optional()
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  await expireAwaitingPaymentReservations();
  assertCsrf(req);
  const session = await requireSession();
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Datos invalidos' }, { status: 400 });

  const reservation = await prisma.reservation.findUnique({
    where: { id: params.id },
    include: { listing: true, payment: true }
  });
  if (!reservation) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
  if (reservation.listing.hostId !== (session.user as any).id) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const nextStatus = parsed.data.status;
  const isPendingApproval =
    reservation.status === ReservationStatus.PENDING_PAYMENT &&
    !reservation.holdExpiresAt &&
    !reservation.payment;
  const actorId = (session.user as any).id as string;

  if (isPendingApproval) {
    if (nextStatus !== ReservationStatus.CONFIRMED && nextStatus !== ReservationStatus.CANCELED) {
      return NextResponse.json({ error: 'Estado invalido para una solicitud pendiente' }, { status: 400 });
    }

    if (nextStatus === ReservationStatus.CONFIRMED) {
      try {
        const result = await approveReservationRequest(reservation.id, actorId);
        return NextResponse.json({ reservation: result.reservation });
      } catch (error: any) {
        const message = error?.message || 'No se pudo aprobar la solicitud';
        const code = message.includes('cupo') ? 409 : message === 'No autorizado' ? 403 : 400;
        return NextResponse.json({ error: message }, { status: code });
      }
    }

    try {
      const result = await rejectReservationRequest(reservation.id, actorId, parsed.data.reason);
      return NextResponse.json({ reservation: result.reservation });
    } catch (error: any) {
      const message = error?.message || 'No se pudo rechazar la solicitud';
      const code = message === 'No autorizado' ? 403 : 400;
      return NextResponse.json({ error: message }, { status: code });
    }
  }

  if (nextStatus !== ReservationStatus.CHECKED_IN && nextStatus !== ReservationStatus.COMPLETED) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const updated = await prisma.reservation.update({
    where: { id: reservation.id },
    data: { status: nextStatus }
  });

  return NextResponse.json({ reservation: updated });
}
