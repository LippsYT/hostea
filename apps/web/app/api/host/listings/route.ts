import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireSession } from '@/lib/permissions';
import { assertCsrf } from '@/lib/csrf';
import { rateLimit } from '@/lib/rate-limit';
import { ListingType, CancelPolicy } from '@prisma/client';

const emptyToUndefined = (value: unknown) =>
  typeof value === 'string' && value.trim().length === 0 ? undefined : value;

const schema = z
  .object({
    title: z.preprocess(emptyToUndefined, z.string().min(3).optional()),
    description: z.preprocess(emptyToUndefined, z.string().min(10).optional()),
    type: z.preprocess(emptyToUndefined, z.nativeEnum(ListingType).optional()),
    address: z.preprocess(emptyToUndefined, z.string().optional()),
    city: z.preprocess(emptyToUndefined, z.string().optional()),
    neighborhood: z.preprocess(emptyToUndefined, z.string().optional()),
    pricePerNight: z.preprocess(emptyToUndefined, z.coerce.number().optional()),
    capacity: z.preprocess(emptyToUndefined, z.coerce.number().optional()),
    beds: z.preprocess(emptyToUndefined, z.coerce.number().optional()),
    baths: z.preprocess(emptyToUndefined, z.coerce.number().optional()),
    cancelPolicy: z.preprocess(emptyToUndefined, z.nativeEnum(CancelPolicy).optional())
  })
  .passthrough();

export async function POST(req: Request) {
  try {
    assertCsrf(req);
    const session = await requireSession();
    const roles = (session.user as any).roles as string[];
    if (!roles.includes('HOST') && !roles.includes('ADMIN')) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
    }
    const ok = await rateLimit(`host:create:${(session.user as any).id}`, 10, 60);
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
    const type = data.type ?? ListingType.APARTMENT;
    const address = data.address?.trim() || 'Direccion pendiente';
    const city = data.city?.trim() || 'Buenos Aires';
    const neighborhood = data.neighborhood?.trim() || 'Palermo';
    const pricePerNight = Number.isFinite(data.pricePerNight) ? data.pricePerNight! : 70;
    const capacity = Number.isFinite(data.capacity) ? data.capacity! : 4;
    const beds = Number.isFinite(data.beds) ? data.beds! : 1;
    const baths = Number.isFinite(data.baths) ? data.baths! : 1;
    const cancelPolicy = data.cancelPolicy ?? CancelPolicy.FLEXIBLE;
    const listing = await prisma.listing.create({
      data: {
        hostId: (session.user as any).id,
        title,
        description,
        type,
        address,
        city,
        neighborhood,
        pricePerNight,
        cleaningFee: 0,
        serviceFee: 0,
        taxRate: 0,
        capacity,
        beds,
        baths,
        cancelPolicy
      }
    });
    return NextResponse.json({ listing });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Error' }, { status: 401 });
  }
}
