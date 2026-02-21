import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireSession } from '@/lib/permissions';
import { assertCsrf } from '@/lib/csrf';

const schema = z.object({
  url: z.string().url(),
  provider: z.string().max(30).optional()
});

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const session = await requireSession();
  const listing = await prisma.listing.findUnique({
    where: { id: params.id },
    select: { id: true, hostId: true, icalToken: true }
  });
  if (!listing || listing.hostId !== (session.user as any).id) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const feeds = await prisma.listingIcalFeed.findMany({
    where: { listingId: listing.id },
    orderBy: { createdAt: 'desc' }
  });

  const appUrl =
    process.env.APP_URL || process.env.NEXTAUTH_URL || 'http://localhost:3001';
  const hosteaIcalUrl = `${appUrl}/api/listings/${listing.id}/ical?token=${listing.icalToken}`;

  return NextResponse.json({ feeds, hosteaIcalUrl });
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    assertCsrf(req);
    const session = await requireSession();
    const listing = await prisma.listing.findUnique({
      where: { id: params.id },
      select: { id: true, hostId: true }
    });
    if (!listing || listing.hostId !== (session.user as any).id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'URL iCal invalida' }, { status: 400 });
    }

    const feed = await prisma.listingIcalFeed.create({
      data: {
        listingId: listing.id,
        url: parsed.data.url.trim(),
        provider: parsed.data.provider?.trim() || null
      }
    });
    return NextResponse.json({ feed });
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return NextResponse.json({ error: 'Ese iCal ya esta agregado.' }, { status: 409 });
    }
    return NextResponse.json({ error: error?.message || 'Error' }, { status: 500 });
  }
}
