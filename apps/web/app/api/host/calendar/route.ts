import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireSession } from '@/lib/permissions';
import { assertCsrf } from '@/lib/csrf';
import { z } from 'zod';

const schema = z.object({
  listingId: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  reason: z.string().optional(),
  price: z.coerce.number().optional()
});

export async function GET(req: Request) {
  const session = await requireSession();
  const { searchParams } = new URL(req.url);
  const listingId = searchParams.get('listingId');
  if (!listingId) return NextResponse.json({ error: 'listingId requerido' }, { status: 400 });

  const listing = await prisma.listing.findUnique({ where: { id: listingId } });
  if (!listing || listing.hostId !== (session.user as any).id) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const blocks = await prisma.calendarBlock.findMany({
    where: { listingId },
    orderBy: { startDate: 'asc' }
  });
  const reservations = await prisma.reservation.findMany({
    where: {
      listingId,
      status: { in: ['CONFIRMED', 'CHECKED_IN', 'COMPLETED'] }
    },
    select: {
      id: true,
      checkIn: true,
      checkOut: true,
      status: true
    },
    orderBy: { checkIn: 'asc' }
  });
  return NextResponse.json({ blocks, reservations });
}

export async function POST(req: Request) {
  assertCsrf(req);
  const session = await requireSession();
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Datos invalidos' }, { status: 400 });

  const listing = await prisma.listing.findUnique({ where: { id: parsed.data.listingId } });
  if (!listing || listing.hostId !== (session.user as any).id) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const block = await prisma.calendarBlock.create({
    data: {
      listingId: parsed.data.listingId,
      startDate: new Date(parsed.data.startDate),
      endDate: new Date(parsed.data.endDate),
      reason: parsed.data.price ? `PRICE:${parsed.data.price}` : parsed.data.reason,
      createdBy: (session.user as any).id
    }
  });
  return NextResponse.json({ block });
}
