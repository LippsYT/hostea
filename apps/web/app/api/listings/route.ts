import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const city = searchParams.get('city');
  const min = searchParams.get('min');
  const max = searchParams.get('max');
  const take = Number(searchParams.get('take') || 20);
  const skip = Number(searchParams.get('skip') || 0);

  const listings = await prisma.listing.findMany({
    where: {
      city: city ? { contains: city, mode: 'insensitive' } : undefined,
      status: 'ACTIVE',
      pricePerNight: {
        gte: min ? Number(min) : undefined,
        lte: max ? Number(max) : undefined
      }
    },
    include: { photos: true },
    take,
    skip,
    orderBy: { createdAt: 'desc' }
  });

  return NextResponse.json({ listings });
}
