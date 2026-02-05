import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/permissions';
import { assertCsrf } from '@/lib/csrf';
import { z } from 'zod';

const schema = z.object({
  status: z.enum(['ACTIVE', 'PAUSED', 'DELETED'])
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    assertCsrf(req);
    const session = await requireRole('HOST');
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: 'Datos invalidos' }, { status: 400 });

    const listing = await prisma.listing.findUnique({ where: { id: params.id } });
    if (!listing) return NextResponse.json({ error: 'Listing no encontrado' }, { status: 404 });

    const roles = (session.user as any)?.roles || [];
    const isAdmin = roles.includes('ADMIN');
    if (!isAdmin && listing.hostId !== (session.user as any).id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const updated = await prisma.listing.update({
      where: { id: listing.id },
      data: { status: parsed.data.status }
    });

    return NextResponse.json({ listing: updated });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Error' }, { status: 500 });
  }
}
