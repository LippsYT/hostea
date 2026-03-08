import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireSession } from '@/lib/permissions';
import { assertCsrf } from '@/lib/csrf';
import {
  calcBreakdown,
  calcClientPriceFromHostNet
} from '@/lib/intelligent-pricing';
import { getSmartPricingParamsFromSettings } from '@/lib/pricing-settings';
import { instantBookFromBookingMode, type BookingMode } from '@/lib/booking-mode';
import { ListingType, CancelPolicy } from '@prisma/client';
import { toGeoSlug } from '@/lib/experience-matching';

const schema = z.object({
  title: z.string().min(3),
  description: z.string().min(10),
  type: z.nativeEnum(ListingType),
  propertyType: z.enum(['apartment', 'hotel']).optional(),
  address: z.string(),
  country: z.string().optional(),
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
  checkInTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).optional(),
  checkOutTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).optional(),
  checkInInstructions: z.string().optional(),
  checkOutInstructions: z.string().optional(),
  assistancePhone: z.string().optional(),
  assistancePhoneSecondary: z.string().optional(),
  mapLocationUrl: z.string().url().or(z.literal('')).optional(),
  propertyRules: z.string().optional(),
  allowChildren: z.coerce.boolean().optional(),
  allowPets: z.coerce.boolean().optional(),
  allowSmoking: z.coerce.boolean().optional(),
  allowParties: z.coerce.boolean().optional(),
  amenityNames: z.array(z.string().min(1)).optional(),
  cancelPolicy: z.nativeEnum(CancelPolicy),
  instantBook: z.coerce.boolean().optional(),
  bookingMode: z.enum(['instant', 'approval']).optional()
});

const syncListingAmenities = async (listingId: string, amenityNames: string[]) => {
  const normalized = Array.from(
    new Set(
      amenityNames
        .map((name) => name.trim())
        .filter(Boolean)
    )
  );

  await prisma.listingAmenity.deleteMany({ where: { listingId } });
  if (normalized.length === 0) return;

  const amenities = await Promise.all(
    normalized.map((name) =>
      prisma.amenity.upsert({
        where: { name },
        update: {},
        create: { name }
      })
    )
  );

  await prisma.listingAmenity.createMany({
    data: amenities.map((amenity) => ({
      listingId,
      amenityId: amenity.id
    })),
    skipDuplicates: true
  });
};

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
  const pricingParams = await getSmartPricingParamsFromSettings();
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
  const checkInTime = data.checkInTime ?? listing.checkInTime ?? '15:00';
  const checkOutTime = data.checkOutTime ?? listing.checkOutTime ?? '11:00';
  const checkInInstructions = data.checkInInstructions?.trim() || null;
  const checkOutInstructions = data.checkOutInstructions?.trim() || null;
  const assistancePhone = data.assistancePhone?.trim() || null;
  const assistancePhoneSecondary = data.assistancePhoneSecondary?.trim() || null;
  const mapLocationUrl = data.mapLocationUrl?.trim() || null;
  const propertyRules = data.propertyRules?.trim() || null;
  const allowChildren = data.allowChildren ?? listing.allowChildren;
  const allowPets = data.allowPets ?? listing.allowPets;
  const allowSmoking = data.allowSmoking ?? listing.allowSmoking;
  const allowParties = data.allowParties ?? listing.allowParties;
  const updated = await prisma.listing.update({
    where: { id: params.id },
    data: {
      title: data.title,
      description: data.description,
      type,
      address: data.address,
      country: data.country || listing.country,
      city: data.city,
      citySlug: toGeoSlug(data.city),
      neighborhood: data.neighborhood,
      zoneSlug: toGeoSlug(data.neighborhood),
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
      checkInTime,
      checkOutTime,
      checkInInstructions,
      checkOutInstructions,
      assistancePhone,
      assistancePhoneSecondary,
      mapLocationUrl,
      propertyRules,
      allowChildren,
      allowPets,
      allowSmoking,
      allowParties,
      cancelPolicy: data.cancelPolicy,
      instantBook
    }
  });
  if (Array.isArray(data.amenityNames)) {
    await syncListingAmenities(updated.id, data.amenityNames);
  }
  return NextResponse.json({ listing: updated });
}
