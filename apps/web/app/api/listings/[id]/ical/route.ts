import { NextResponse } from 'next/server';
import { ReservationStatus } from '@prisma/client';
import { prisma } from '@/lib/db';
import { buildIcal } from '@/lib/ical';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get('token');
  if (!token) {
    return NextResponse.json({ error: 'Token requerido' }, { status: 401 });
  }

  const listing = await prisma.listing.findUnique({
    where: { id: params.id },
    select: { id: true, title: true, icalToken: true }
  });
  if (!listing || listing.icalToken !== token) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const now = new Date();
  const reservations = await prisma.reservation.findMany({
    where: {
      listingId: listing.id,
      OR: [
        { status: ReservationStatus.CONFIRMED },
        { status: ReservationStatus.CHECKED_IN },
        { status: ReservationStatus.COMPLETED },
        {
          status: ReservationStatus.PENDING_PAYMENT,
          holdExpiresAt: { gt: now }
        }
      ]
    },
    select: { id: true, checkIn: true, checkOut: true }
  });

  const manualBlocks = await prisma.calendarBlock.findMany({
    where: {
      listingId: listing.id,
      AND: [
        {
          NOT: {
            reason: { startsWith: 'PRICE:' }
          }
        },
        {
          NOT: {
            createdBy: { startsWith: 'ICAL:' }
          }
        }
      ]
    },
    select: { id: true, startDate: true, endDate: true, reason: true }
  });

  const events = [
    ...reservations.map((reservation) => ({
      uid: `hostea-reservation-${reservation.id}`,
      startDate: reservation.checkIn,
      endDate: reservation.checkOut,
      summary: `${listing.title} - Reservado`
    })),
    ...manualBlocks.map((block) => ({
      uid: `hostea-block-${block.id}`,
      startDate: block.startDate,
      endDate: block.endDate,
      summary: `${listing.title} - ${block.reason || 'Bloqueado'}`
    }))
  ];

  const content = buildIcal(events);
  return new NextResponse(content, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="hostea-${listing.id}.ics"`,
      'Cache-Control': 'no-store'
    }
  });
}
