import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireSession } from '@/lib/permissions';
import { assertCsrf } from '@/lib/csrf';
import { getSetting } from '@/lib/settings';
import { calculateHostSplit } from '@/lib/finance';
import { z } from 'zod';

export async function POST(req: Request) {
  assertCsrf(req);
  const session = await requireSession();
  const roles = (session.user as any).roles || [];
  if (!roles.includes('ADMIN')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }
  const body = await req.json();
  const parsed = z.object({ reservationId: z.string() }).safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Datos invalidos' }, { status: 400 });

  const commissionPercent = await getSetting<number>('commissionPercent', 0.15);
  const reservation = await prisma.reservation.findUnique({
    where: { id: parsed.data.reservationId },
    include: { listing: { include: { host: true } }, payment: true }
  });
  if (!reservation || reservation.payment?.status !== 'SUCCEEDED') {
    return NextResponse.json({ error: 'Reserva no apta para pago' }, { status: 400 });
  }

  const total = Number(reservation.total);
  const split = calculateHostSplit(total, commissionPercent);
  const payouts = await prisma.payout.findMany({ where: { reservationId: reservation.id } });
  const paid = payouts.reduce((acc, p) => acc + Number(p.amount), 0);
  const due = Math.max(split.host - paid, 0);
  if (due <= 0) return NextResponse.json({ error: 'Sin saldo pendiente' }, { status: 400 });

  const payout = await prisma.payout.create({
    data: {
      hostId: reservation.listing.hostId,
      reservationId: reservation.id,
      amount: due,
      status: 'PAID'
    }
  });

  await prisma.auditLog.create({
    data: {
      actorId: (session.user as any).id,
      action: 'PAYOUT_MARKED',
      entity: 'Reservation',
      entityId: reservation.id,
      meta: { amount: due }
    }
  });

  return NextResponse.json({ payout });
}
