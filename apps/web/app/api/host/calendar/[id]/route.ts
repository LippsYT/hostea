import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireSession } from '@/lib/permissions';
import { assertCsrf } from '@/lib/csrf';

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  assertCsrf(req);
  const session = await requireSession();
  const block = await prisma.calendarBlock.findUnique({ where: { id: params.id }, include: { listing: true } });
  if (!block || block.listing.hostId !== (session.user as any).id) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }
  if ((block.createdBy || '').startsWith('ICAL:')) {
    return NextResponse.json(
      { error: 'El bloqueo viene de un calendario externo. Desactiva o elimina el feed iCal.' },
      { status: 400 }
    );
  }
  await prisma.calendarBlock.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
