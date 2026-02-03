import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireSession } from '@/lib/permissions';
import { assertCsrf } from '@/lib/csrf';
import { z } from 'zod';

const schema = z.object({
  message: z.string().min(2)
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  assertCsrf(req);
  const session = await requireSession();
  const roles = (session.user as any).roles as string[];
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Datos invalidos' }, { status: 400 });

  const ticket = await prisma.ticket.findUnique({ where: { id: params.id } });
  if (!ticket) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
  const isOwner = ticket.createdById === (session.user as any).id;
  const canReply = isOwner || roles.includes('SUPPORT') || roles.includes('ADMIN') || roles.includes('MODERATOR');
  if (!canReply) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  await prisma.ticketMessage.create({
    data: {
      ticketId: params.id,
      senderId: (session.user as any).id,
      body: parsed.data.message
    }
  });

  return NextResponse.json({ ok: true });
}
