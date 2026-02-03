import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireSession } from '@/lib/permissions';
import { assertCsrf } from '@/lib/csrf';
import { rateLimit } from '@/lib/rate-limit';
import { ListingType, CancelPolicy } from '@prisma/client';

const schema = z.object({
  title: z.string().min(3),
  description: z.string().min(10),
  type: z.nativeEnum(ListingType),
  address: z.string(),
  city: z.string(),
  neighborhood: z.string(),
  pricePerNight: z.coerce.number(),
  capacity: z.coerce.number(),
  beds: z.coerce.number(),
  baths: z.coerce.number(),
  cancelPolicy: z.nativeEnum(CancelPolicy)
});

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
      return NextResponse.json({ error: 'Datos invalidos' }, { status: 400 });
    }
    const data = parsed.data;
    const listing = await prisma.listing.create({
      data: {
        hostId: (session.user as any).id,
        title: data.title,
        description: data.description,
        type: data.type,
        address: data.address,
        city: data.city,
        neighborhood: data.neighborhood,
        pricePerNight: data.pricePerNight,
        cleaningFee: 10,
        serviceFee: 10,
        taxRate: 0.1,
        capacity: data.capacity,
        beds: data.beds,
        baths: data.baths,
        cancelPolicy: data.cancelPolicy
      }
    });
    return NextResponse.json({ listing });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Error' }, { status: 401 });
  }
}
