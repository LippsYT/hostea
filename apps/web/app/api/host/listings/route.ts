import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireSession } from '@/lib/permissions';
import { assertCsrf } from '@/lib/csrf';
import { rateLimit } from '@/lib/rate-limit';
import { ListingType, CancelPolicy } from '@prisma/client';

const schema = z
  .object({
    title: z.string().min(3).optional(),
    description: z.string().min(10).optional(),
    type: z.nativeEnum(ListingType).optional(),
    address: z.string().optional(),
    city: z.string().optional(),
    neighborhood: z.string().optional(),
    pricePerNight: z.coerce.number().optional(),
    capacity: z.coerce.number().optional(),
    beds: z.coerce.number().optional(),
    baths: z.coerce.number().optional(),
    cancelPolicy: z.nativeEnum(CancelPolicy).optional()
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
        cleaningFee: 10,
        serviceFee: 10,
        taxRate: 0.1,
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
