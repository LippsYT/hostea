import { NextResponse } from 'next/server';
import { z } from 'zod';
import { addDays } from 'date-fns';
import { prisma } from '@/lib/db';
import { assertCsrf } from '@/lib/csrf';
import { requireSession } from '@/lib/permissions';
import {
  buildDynamicBreakdown,
  normalizeDynamicPricingConfig
} from '@/lib/dynamic-pricing';
import {
  computeOccupancyRateForListing,
  getDynamicPricingConfigForListing,
  saveDynamicPricingConfigForListing
} from '@/lib/dynamic-pricing-service';

const schema = z.object({
  enabled: z.boolean(),
  basePrice: z.coerce.number().positive(),
  minPrice: z.coerce.number().positive(),
  maxPrice: z.coerce.number().positive()
});

const canEditListing = async (listingId: string, userId: string) => {
  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    select: { hostId: true, pricePerNight: true }
  });
  if (!listing) return null;
  if (listing.hostId !== userId) return null;
  return listing;
};

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const session = await requireSession();
  const userId = (session.user as any).id as string;
  const listing = await canEditListing(params.id, userId);
  if (!listing) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const configResult = await getDynamicPricingConfigForListing(params.id);
  const config = normalizeDynamicPricingConfig(
    configResult?.config,
    Number(listing.pricePerNight)
  );

  const previewFrom = new Date();
  const previewTo = addDays(previewFrom, 7);
  const occupancyRate = await computeOccupancyRateForListing({
    listingId: params.id,
    from: previewFrom,
    to: addDays(previewFrom, 60)
  });
  const preview = config.enabled
    ? buildDynamicBreakdown({
        checkIn: previewFrom,
        checkOut: previewTo,
        occupancyRate,
        config
      })
    : [];

  return NextResponse.json({ config, occupancyRate, preview });
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  assertCsrf(req);
  const session = await requireSession();
  const userId = (session.user as any).id as string;
  const listing = await canEditListing(params.id, userId);
  if (!listing) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos invalidos' }, { status: 400 });
  }

  const normalized = normalizeDynamicPricingConfig(parsed.data, Number(listing.pricePerNight));
  const config = await saveDynamicPricingConfigForListing(params.id, normalized);
  return NextResponse.json({ config });
}
