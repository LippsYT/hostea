import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireSession } from '@/lib/permissions';

export async function GET() {
  const session = await requireSession();
  const userId = (session.user as any).id;
  const reservations = await prisma.reservation.findMany({
    where: { userId },
    include: { listing: true }
  });
  return NextResponse.json({ reservations });
}
