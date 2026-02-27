import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireSession } from '@/lib/permissions';
import { assertCsrf } from '@/lib/csrf';
import { z } from 'zod';
import { ReservationStatus } from '@prisma/client';
import { sendAutoMessagesOnConfirm } from '@/lib/auto-messages';
import { checkListingAvailability } from '@/lib/listing-availability';

const schema = z.object({
  status: z.nativeEnum(ReservationStatus),
  reason: z.string().max(240).optional()
});

const isPendingApprovalReservation = (reservation: {
  status: ReservationStatus;
  holdExpiresAt: Date | null;
  payment: unknown;
}) =>
  reservation.status === ReservationStatus.PENDING_PAYMENT &&
  reservation.holdExpiresAt === null &&
  !reservation.payment;

export async function POST(req: Request, { params }: { params: { id: string } }) {
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
  const isPendingApproval = isPendingApprovalReservation(reservation);
  const actorId = (session.user as any).id as string;

  if (isPendingApproval) {
    if (nextStatus !== ReservationStatus.CONFIRMED && nextStatus !== ReservationStatus.CANCELED) {
      return NextResponse.json({ error: 'Estado invalido para una solicitud pendiente' }, { status: 400 });
    }

    if (nextStatus === ReservationStatus.CONFIRMED) {
      const availability = await checkListingAvailability({
        listingId: reservation.listingId,
        checkIn: reservation.checkIn,
        checkOut: reservation.checkOut,
        guests: reservation.guestsCount,
        excludeReservationId: reservation.id
      });
      if (!availability.available) {
        return NextResponse.json(
          { error: availability.message || 'Ya no hay cupo para esas fechas.' },
          { status: 409 }
        );
      }

      const updated = await prisma.$transaction(async (tx) => {
        const next = await tx.reservation.update({
          where: { id: reservation.id },
          data: { status: ReservationStatus.CONFIRMED }
        });
        await tx.calendarBlock.create({
          data: {
            listingId: reservation.listingId,
            startDate: reservation.checkIn,
            endDate: reservation.checkOut,
            reason: 'Reserva confirmada (aprobada por host)',
            createdBy: reservation.userId
          }
        });
        await tx.auditLog.create({
          data: {
            actorId,
            action: 'RESERVATION_APPROVED',
            entity: 'Reservation',
            entityId: reservation.id,
            meta: { approvedBy: actorId, approvedAt: new Date() }
          }
        });
        return next;
      });
      await sendAutoMessagesOnConfirm(reservation.id);
      return NextResponse.json({ reservation: updated });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const next = await tx.reservation.update({
        where: { id: reservation.id },
        data: { status: ReservationStatus.CANCELED }
      });
      await tx.auditLog.create({
        data: {
          actorId,
          action: 'RESERVATION_REJECTED',
          entity: 'Reservation',
          entityId: reservation.id,
          meta: { rejectedAt: new Date(), reason: parsed.data.reason || null }
        }
      });
      return next;
    });
    return NextResponse.json({ reservation: updated });
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
