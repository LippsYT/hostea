import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireSession } from '@/lib/permissions';
import { assertCsrf } from '@/lib/csrf';
import { ListingType, CancelPolicy } from '@prisma/client';

const schema = z.object({
  title: z.string().min(3),
  description: z.string().min(10),
  type: z.nativeEnum(ListingType),
  address: z.string(),
  city: z.string(),
  neighborhood: z.string(),
  pricePerNight: z.coerce.number(),
  cleaningFee: z.coerce.number(),
  taxRate: z.coerce.number(),
  capacity: z.coerce.number(),
  beds: z.coerce.number(),
  baths: z.coerce.number(),
  cancelPolicy: z.nativeEnum(CancelPolicy),
  instantBook: z.coerce.boolean().optional()
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
  const normalizedTaxRate = data.taxRate > 1 ? data.taxRate / 100 : data.taxRate;
  const updated = await prisma.listing.update({
    where: { id: params.id },
    data: {
      title: data.title,
      description: data.description,
      type: data.type,
      address: data.address,
      city: data.city,
      neighborhood: data.neighborhood,
      pricePerNight: data.pricePerNight,
      cleaningFee: data.cleaningFee,
      serviceFee: 0,
      taxRate: normalizedTaxRate,
      capacity: data.capacity,
      beds: data.beds,
      baths: data.baths,
      cancelPolicy: data.cancelPolicy,
      instantBook: data.instantBook ?? listing.instantBook
    }
  });
  return NextResponse.json({ listing: updated });
}
