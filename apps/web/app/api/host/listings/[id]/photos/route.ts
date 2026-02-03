import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireSession } from '@/lib/permissions';
import { assertCsrf } from '@/lib/csrf';
import { z } from 'zod';

const schema = z.object({
  url: z.string().url()
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  assertCsrf(req);
  const session = await requireSession();
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos invalidos' }, { status: 400 });
  }
  const listing = await prisma.listing.findUnique({ where: { id: params.id }, include: { photos: true } });
  if (!listing || listing.hostId !== (session.user as any).id) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }
  const sortOrder = listing.photos.length + 1;
  const photo = await prisma.listingPhoto.create({
    data: {
      listingId: listing.id,
      url: parsed.data.url,
      sortOrder
    }
  });
  return NextResponse.json({ photo });
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  assertCsrf(req);
  const session = await requireSession();
  const body = await req.json();
  const parsed = z.object({ photoId: z.string() }).safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos invalidos' }, { status: 400 });
  }
  const listing = await prisma.listing.findUnique({ where: { id: params.id }, include: { photos: true } });
  if (!listing || listing.hostId !== (session.user as any).id) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }
  await prisma.$transaction([
    prisma.listingPhoto.updateMany({
      where: { listingId: listing.id },
      data: { sortOrder: { increment: 1 } }
    }),
    prisma.listingPhoto.update({
      where: { id: parsed.data.photoId },
      data: { sortOrder: 0 }
    })
  ]);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  assertCsrf(req);
  const session = await requireSession();
  const { searchParams } = new URL(req.url);
  const photoId = searchParams.get('photoId');
  if (!photoId) return NextResponse.json({ error: 'photoId requerido' }, { status: 400 });

  const listing = await prisma.listing.findUnique({ where: { id: params.id } });
  if (!listing || listing.hostId !== (session.user as any).id) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }
  await prisma.listingPhoto.delete({ where: { id: photoId } });
  return NextResponse.json({ ok: true });
}
