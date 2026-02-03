import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  const settings = await prisma.settings.findMany();
  const map = settings.reduce((acc, s) => ({ ...acc, [s.key]: s.value }), {} as Record<string, any>);
  return NextResponse.json({ settings: map });
}
