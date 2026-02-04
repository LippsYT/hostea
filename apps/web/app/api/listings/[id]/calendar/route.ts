import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const { searchParams } = new URL(req.url);
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const listingId = params.id;

  const listing = await prisma.listing.findUnique({ where: { id: listingId } });
  if (!listing || listing.status !== 'ACTIVE') {
    return NextResponse.json({ overrides: [] });
  }

  if (!from || !to) return NextResponse.json({ overrides: [] });
  const fromDate = new Date(from);
  const toDate = new Date(to);
  if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
    return NextResponse.json({ overrides: [] });
  }

  const blocks = await prisma.calendarBlock.findMany({
    where: {
      listingId,
      reason: { startsWith: 'PRICE:' },
      startDate: { lte: toDate },
      endDate: { gte: fromDate }
    }
  });

  const overrides = blocks
    .map((b) => {
      const raw = (b.reason || '').replace('PRICE:', '');
      const value = Number(raw);
      if (!Number.isFinite(value)) return null;
      return { startDate: b.startDate, endDate: b.endDate, price: value };
    })
    .filter(Boolean);

  return NextResponse.json({ overrides });
}
