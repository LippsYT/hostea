import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireSession } from '@/lib/permissions';
import { assertCsrf } from '@/lib/csrf';
import { syncListingIcalFeeds } from '@/lib/ical-sync';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  assertCsrf(req);
  const session = await requireSession();
  const listing = await prisma.listing.findUnique({
    where: { id: params.id },
    select: { id: true, hostId: true }
  });
  if (!listing || listing.hostId !== (session.user as any).id) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const results = await syncListingIcalFeeds(listing.id);
  return NextResponse.json({ results });
}
