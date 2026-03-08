import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireSession } from '@/lib/permissions';
import { assertCsrf } from '@/lib/csrf';
import { rateLimit } from '@/lib/rate-limit';
import {
  calcBreakdown,
  calcClientPriceFromHostNet,
  defaultSmartPricingParams
} from '@/lib/intelligent-pricing';
import { getSmartPricingParamsFromSettings } from '@/lib/pricing-settings';
import { instantBookFromBookingMode, type BookingMode } from '@/lib/booking-mode';
import { ListingType, CancelPolicy } from '@prisma/client';
import { toGeoSlug } from '@/lib/experience-matching';

const emptyToUndefined = (value: unknown) =>
  typeof value === 'string' && value.trim().length === 0 ? undefined : value;

const schema = z
  .object({
    title: z.preprocess(emptyToUndefined, z.string().min(3).optional()),
    description: z.preprocess(emptyToUndefined, z.string().min(10).optional()),
    type: z.preprocess(emptyToUndefined, z.nativeEnum(ListingType).optional()),
    propertyType: z.preprocess(emptyToUndefined, z.enum(['apartment', 'hotel']).optional()),
    address: z.preprocess(emptyToUndefined, z.string().optional()),
    country: z.preprocess(emptyToUndefined, z.string().optional()),
    city: z.preprocess(emptyToUndefined, z.string().optional()),
    neighborhood: z.preprocess(emptyToUndefined, z.string().optional()),
    pricePerNight: z.preprocess(emptyToUndefined, z.coerce.number().optional()),
    netoDeseadoUsd: z.preprocess(emptyToUndefined, z.coerce.number().optional()),
    precioClienteCalculadoUsd: z.preprocess(emptyToUndefined, z.coerce.number().optional()),
    capacity: z.preprocess(emptyToUndefined, z.coerce.number().optional()),
    inventoryQty: z.preprocess(emptyToUndefined, z.coerce.number().int().min(1).optional()),
    beds: z.preprocess(emptyToUndefined, z.coerce.number().optional()),
    baths: z.preprocess(emptyToUndefined, z.coerce.number().optional()),
    checkInTime: z
      .preprocess(emptyToUndefined, z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).optional()),
    checkOutTime: z
      .preprocess(emptyToUndefined, z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).optional()),
    checkInInstructions: z.preprocess(emptyToUndefined, z.string().optional()),
    checkOutInstructions: z.preprocess(emptyToUndefined, z.string().optional()),
    assistancePhone: z.preprocess(emptyToUndefined, z.string().optional()),
    assistancePhoneSecondary: z.preprocess(emptyToUndefined, z.string().optional()),
    mapLocationUrl: z.preprocess(emptyToUndefined, z.string().url().optional()),
    propertyRules: z.preprocess(emptyToUndefined, z.string().optional()),
    allowChildren: z.preprocess(emptyToUndefined, z.coerce.boolean().optional()),
    allowPets: z.preprocess(emptyToUndefined, z.coerce.boolean().optional()),
    allowSmoking: z.preprocess(emptyToUndefined, z.coerce.boolean().optional()),
    allowParties: z.preprocess(emptyToUndefined, z.coerce.boolean().optional()),
    amenityNames: z.array(z.string().min(1)).optional(),
    cancelPolicy: z.preprocess(emptyToUndefined, z.nativeEnum(CancelPolicy).optional()),
    instantBook: z.preprocess(emptyToUndefined, z.coerce.boolean().optional()),
    bookingMode: z.preprocess(
      emptyToUndefined,
      z.enum(['instant', 'approval']).optional()
    )
  })
  .passthrough();

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

export async function POST(req: Request) {
  try {
    assertCsrf(req);
    const session = await requireSession();
    const userId = (session.user as any).id as string;
    const roles = ((session.user as any).roles || []) as string[];
    if (!roles.includes('HOST') && !roles.includes('ADMIN')) {
      const hostRole = await prisma.role.findUnique({ where: { name: 'HOST' } });
      if (!hostRole) {
        return NextResponse.json({ error: 'No se encontro el rol HOST' }, { status: 500 });
      }
      await prisma.userRole.upsert({
        where: { userId_roleId: { userId, roleId: hostRole.id } },
        update: {},
        create: { userId, roleId: hostRole.id }
      });
    }
    const ok = await rateLimit(`host:create:${userId}`, 10, 60);
    if (!ok) return NextResponse.json({ error: 'Rate limit' }, { status: 429 });

    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos invalidos', issues: parsed.error.issues },
        { status: 400 }
      );
    }
    const data = parsed.data;
    const title = data.title?.trim() || 'Nuevo alojamiento';
    const description =
      data.description?.trim() || 'Espacio comodo con amenities esenciales y excelente ubicacion.';
    const type =
      data.type ??
      (data.propertyType === 'hotel'
        ? ListingType.HOTEL
        : data.propertyType === 'apartment'
          ? ListingType.APARTMENT
          : ListingType.APARTMENT);
    const address = data.address?.trim() || 'Direccion pendiente';
    const country = data.country?.trim() || 'Argentina';
    const city = data.city?.trim() || 'Buenos Aires';
    const neighborhood = data.neighborhood?.trim() || 'Palermo';
    const citySlug = toGeoSlug(city);
    const zoneSlug = toGeoSlug(neighborhood);
    const pricingParams = await getSmartPricingParamsFromSettings();
    const desiredNet = Number.isFinite(data.netoDeseadoUsd) ? Math.max(0, data.netoDeseadoUsd!) : null;
    const rawPrice = Number.isFinite(data.pricePerNight) ? Math.max(0, data.pricePerNight!) : 70;
    const pricePerNight =
      desiredNet !== null ? calcClientPriceFromHostNet(desiredNet, pricingParams) : rawPrice;
    const netoDeseadoUsd =
      desiredNet !== null ? desiredNet : calcBreakdown(pricePerNight, pricingParams).hostNet;
    const precioClienteCalculadoUsd = pricePerNight;
    const capacity = Number.isFinite(data.capacity) ? data.capacity! : 4;
    const inventoryQtyRaw = Number.isFinite(data.inventoryQty) ? data.inventoryQty! : 1;
    const inventoryQty = type === ListingType.HOTEL ? Math.max(1, inventoryQtyRaw) : 1;
    const beds = Number.isFinite(data.beds) ? data.beds! : 1;
    const baths = Number.isFinite(data.baths) ? data.baths! : 1;
    const checkInTime = data.checkInTime ?? '15:00';
    const checkOutTime = data.checkOutTime ?? '11:00';
    const checkInInstructions = data.checkInInstructions?.trim() || null;
    const checkOutInstructions = data.checkOutInstructions?.trim() || null;
    const assistancePhone = data.assistancePhone?.trim() || null;
    const assistancePhoneSecondary = data.assistancePhoneSecondary?.trim() || null;
    const mapLocationUrl = data.mapLocationUrl?.trim() || null;
    const propertyRules = data.propertyRules?.trim() || null;
    const allowChildren = data.allowChildren ?? true;
    const allowPets = data.allowPets ?? false;
    const allowSmoking = data.allowSmoking ?? false;
    const allowParties = data.allowParties ?? false;
    const amenityNames = data.amenityNames ?? [];
    const cancelPolicy = data.cancelPolicy ?? CancelPolicy.FLEXIBLE;
    const bookingMode = data.bookingMode as BookingMode | undefined;
    const instantBook =
      bookingMode !== undefined
        ? instantBookFromBookingMode(bookingMode)
        : data.instantBook ?? true;
    const listing = await prisma.listing.create({
      data: {
        hostId: userId,
        title,
        description,
        type,
        address,
        country,
        city,
        citySlug,
        neighborhood,
        zoneSlug,
        pricePerNight,
        netoDeseadoUsd,
        precioClienteCalculadoUsd,
        cleaningFee: 0,
        serviceFee: 0,
        taxRate: 0,
        capacity,
        inventoryQty,
        beds,
        baths,
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
        cancelPolicy,
        instantBook
      }
    });
    await syncListingAmenities(listing.id, amenityNames);
    return NextResponse.json({ listing });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Error' }, { status: 401 });
  }
}
