import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireSession } from '@/lib/permissions';
import { assertCsrf } from '@/lib/csrf';
import { syncIcalFeedById } from '@/lib/ical-sync';

const getFeedForHost = async (listingId: string, feedId: string, userId: string) => {
  const feed = await prisma.listingIcalFeed.findUnique({
    where: { id: feedId },
    include: { listing: { select: { id: true, hostId: true } } }
  });
  if (!feed) return null;
  if (feed.listingId !== listingId) return null;
  if (feed.listing.hostId !== userId) return null;
  return feed;
};

export async function DELETE(
  req: Request,
  { params }: { params: { id: string; feedId: string } }
) {
  assertCsrf(req);
  const session = await requireSession();
  const userId = (session.user as any).id as string;
  const feed = await getFeedForHost(params.id, params.feedId, userId);
  if (!feed) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  await prisma.calendarBlock.deleteMany({
    where: { listingId: feed.listingId, createdBy: `ICAL:${feed.id}` }
  });
  await prisma.listingIcalFeed.delete({ where: { id: feed.id } });

  return NextResponse.json({ ok: true });
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string; feedId: string } }
) {
  assertCsrf(req);
  const session = await requireSession();
  const userId = (session.user as any).id as string;
  const feed = await getFeedForHost(params.id, params.feedId, userId);
  if (!feed) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const isActive = Boolean(body?.isActive);
  const updated = await prisma.listingIcalFeed.update({
    where: { id: feed.id },
    data: { isActive }
  });
  return NextResponse.json({ feed: updated });
}

export async function POST(
  req: Request,
  { params }: { params: { id: string; feedId: string } }
) {
  assertCsrf(req);
  const session = await requireSession();
  const userId = (session.user as any).id as string;
  const feed = await getFeedForHost(params.id, params.feedId, userId);
  if (!feed) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const result = await syncIcalFeedById(feed.id);
  if (!result.ok) {
    return NextResponse.json({ error: result.error || 'Error de sincronizacion' }, { status: 400 });
  }
  return NextResponse.json({ result });
}
