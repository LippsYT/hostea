import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/permissions';

export async function GET() {
  await requireRole('ADMIN');
  const submissions = await prisma.kycSubmission.findMany({
    include: { user: { include: { profile: true } } },
    orderBy: { createdAt: 'desc' }
  });
  return NextResponse.json({ submissions });
}
