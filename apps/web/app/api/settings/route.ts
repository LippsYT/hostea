import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  const { prisma } = await import('@/lib/db');
  const settings = await prisma.settings.findMany();
  const map = settings.reduce((acc, s) => ({ ...acc, [s.key]: s.value }), {} as Record<string, any>);
  return NextResponse.json({ settings: map });
}
