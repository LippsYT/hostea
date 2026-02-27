import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireSession } from '@/lib/permissions';
import { assertCsrf } from '@/lib/csrf';
import { getSetting } from '@/lib/settings';
import {
  calcBreakdown,
  calcClientPriceFromHostNet,
  defaultSmartPricingParams,
  withSmartPricingParams
} from '@/lib/intelligent-pricing';
import { instantBookFromBookingMode, type BookingMode } from '@/lib/booking-mode';
import { ListingType, CancelPolicy } from '@prisma/client';

const schema = z.object({
  title: z.string().min(3),
  description: z.string().min(10),
  type: z.nativeEnum(ListingType),
  propertyType: z.enum(['apartment', 'hotel']).optional(),
  address: z.string(),
  city: z.string(),
  neighborhood: z.string(),
  pricePerNight: z.coerce.number(),
  netoDeseadoUsd: z.coerce.number().optional(),
  precioClienteCalculadoUsd: z.coerce.number().optional(),
  cleaningFee: z.coerce.number(),
  taxRate: z.coerce.number(),
  capacity: z.coerce.number(),
  inventoryQty: z.coerce.number().int().min(1).optional(),
  beds: z.coerce.number(),
  baths: z.coerce.number(),
  cancelPolicy: z.nativeEnum(CancelPolicy),
  instantBook: z.coerce.boolean().optional(),
  bookingMode: z.enum(['instant', 'approval']).optional()
});

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const session = await requireSession();
  const listing = await prisma.listing.findUnique({
    where: { id: params.id },
    include: { photos: true }
  });
  if (!listing || listing.hostId !== (session.user as any).id) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }
  return NextResponse.json({ listing });
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  assertCsrf(req);
  const session = await requireSession();
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos invalidos' }, { status: 400 });
  }
  const listing = await prisma.listing.findUnique({ where: { id: params.id } });
  if (!listing || listing.hostId !== (session.user as any).id) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }
  const data = parsed.data;
  const platformPct = await getSetting<number>(
    'commissionPercent',
    defaultSmartPricingParams.platformPct
  );
  const pricingParams = withSmartPricingParams({ platformPct });
  const desiredNet =
    typeof data.netoDeseadoUsd === 'number' && Number.isFinite(data.netoDeseadoUsd)
      ? Math.max(0, data.netoDeseadoUsd)
      : null;
  const rawPrice = Number.isFinite(data.pricePerNight) ? Math.max(0, data.pricePerNight) : 0;
  const pricePerNight =
    desiredNet !== null ? calcClientPriceFromHostNet(desiredNet, pricingParams) : rawPrice;
  const netoDeseadoUsd =
    desiredNet !== null ? desiredNet : calcBreakdown(pricePerNight, pricingParams).hostNet;
  const precioClienteCalculadoUsd = pricePerNight;
  const type =
    data.type ??
    (data.propertyType === 'hotel'
      ? ListingType.HOTEL
      : data.propertyType === 'apartment'
        ? ListingType.APARTMENT
        : listing.type);
  const normalizedTaxRate = data.taxRate > 1 ? data.taxRate / 100 : data.taxRate;
  const bookingMode = data.bookingMode as BookingMode | undefined;
  const instantBook =
    bookingMode !== undefined
      ? instantBookFromBookingMode(bookingMode)
      : data.instantBook ?? listing.instantBook;
  const inventoryQtyRaw =
    typeof data.inventoryQty === 'number' && Number.isFinite(data.inventoryQty)
      ? data.inventoryQty
      : listing.inventoryQty;
  const inventoryQty = type === ListingType.HOTEL ? Math.max(1, inventoryQtyRaw) : 1;
  const updated = await prisma.listing.update({
    where: { id: params.id },
    data: {
      title: data.title,
      description: data.description,
      type,
      address: data.address,
      city: data.city,
      neighborhood: data.neighborhood,
      pricePerNight,
      netoDeseadoUsd,
      precioClienteCalculadoUsd,
      cleaningFee: data.cleaningFee,
      serviceFee: 0,
      taxRate: normalizedTaxRate,
      capacity: data.capacity,
      inventoryQty,
      beds: data.beds,
      baths: data.baths,
      cancelPolicy: data.cancelPolicy,
      instantBook
    }
  });
  return NextResponse.json({ listing: updated });
}
