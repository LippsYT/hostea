import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  await requireRole('ADMIN');
  const { prisma } = await import('@/lib/db');
  const audit = await prisma.auditLog.findMany({
    include: { actor: { include: { profile: true } } },
    orderBy: { createdAt: 'desc' },
    take: 200
  });
  return NextResponse.json({ audit });
}
