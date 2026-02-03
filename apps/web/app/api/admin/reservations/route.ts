import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/permissions';

export async function GET() {
  await requireRole('ADMIN');
  const reservations = await prisma.reservation.findMany({
    include: { listing: true, user: true, payment: true },
    orderBy: { createdAt: 'desc' }
  });
  return NextResponse.json({ reservations });
}
