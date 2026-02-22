import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { buildEffectivePriceOverrides } from '@/lib/dynamic-pricing-service';

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

  const pricing = await buildEffectivePriceOverrides({
    listingId,
    checkIn: fromDate,
    checkOut: toDate
  });

  return NextResponse.json({
    overrides: pricing.overrides,
    dynamicPricing: {
      enabled: Boolean(pricing.dynamicConfig?.enabled),
      occupancyRate: pricing.occupancyRate,
      breakdown: pricing.dynamicBreakdown
    }
  });
}
