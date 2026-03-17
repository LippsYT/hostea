import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireSession } from '@/lib/permissions';
import { assertCsrf } from '@/lib/csrf';
import { z } from 'zod';

const schema = z.object({
  status: z.enum(['ACTIVE', 'PAUSED', 'DELETED'])
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    assertCsrf(req);
    const session = await requireSession();
    const sessionUser = session.user as any;
    const roles = Array.isArray(sessionUser?.roles) ? sessionUser.roles : [];
    const isAdmin = roles.includes('ADMIN');
    const isHost = roles.includes('HOST');
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: 'Datos invalidos' }, { status: 400 });

    if (!isAdmin && !isHost) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
    }

    const listing = await prisma.listing.findUnique({ where: { id: params.id } });
    if (!listing) return NextResponse.json({ error: 'Listing no encontrado' }, { status: 404 });

    if (!isAdmin && listing.hostId !== sessionUser?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const updated = await prisma.listing.update({
      where: { id: listing.id },
      data: { status: parsed.data.status }
    });

    return NextResponse.json({ listing: updated });
  } catch (error: any) {
    const message = error?.message || 'Error';
    const status = message === 'No autorizado' ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
