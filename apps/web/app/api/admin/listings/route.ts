import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/permissions';
import { assertCsrf } from '@/lib/csrf';
import { z } from 'zod';

const schema = z.object({
  listingId: z.string(),
  status: z.string()
});

export async function GET() {
  await requireRole('ADMIN');
  const listings = await prisma.listing.findMany({
    include: { host: { include: { profile: true } } },
    orderBy: { createdAt: 'desc' }
  });
  return NextResponse.json({ listings });
}

export async function POST(req: Request) {
  try {
    assertCsrf(req);
    const session = await requireRole('ADMIN');
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: 'Datos invalidos' }, { status: 400 });

    const listing = await prisma.listing.update({
      where: { id: parsed.data.listingId },
      data: { status: parsed.data.status }
    });

    await prisma.auditLog.create({
      data: {
        actorId: (session.user as any).id,
        action: 'LISTING_STATUS_UPDATE',
        entity: 'Listing',
        entityId: listing.id,
        meta: { status: parsed.data.status }
      }
    });

    return NextResponse.json({ listing });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Error' }, { status: 500 });
  }
}
