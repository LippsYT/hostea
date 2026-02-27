import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { assertCsrf } from '@/lib/csrf';
import { requireSession } from '@/lib/permissions';
import { instantBookFromBookingMode } from '@/lib/booking-mode';

const schema = z.object({
  mode: z.enum(['instant', 'approval'])
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    assertCsrf(req);
    const session = await requireSession();
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Modo de reservas invalido' }, { status: 400 });
    }

    const listing = await prisma.listing.findUnique({
      where: { id: params.id },
      select: { id: true, hostId: true, instantBook: true }
    });
    if (!listing || listing.hostId !== (session.user as any).id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const instantBook = instantBookFromBookingMode(parsed.data.mode);
    const updated = await prisma.listing.update({
      where: { id: listing.id },
      data: { instantBook }
    });

    return NextResponse.json({
      listing: {
        id: updated.id,
        instantBook: updated.instantBook,
        bookingMode: updated.instantBook ? 'instant' : 'approval'
      }
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Error' }, { status: 500 });
  }
}

