import { NextResponse } from 'next/server';
import { checkListingAvailability } from '@/lib/listing-availability';

const parseGuests = (value: string | null) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 1;
  return Math.max(1, Math.trunc(parsed));
};

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const { searchParams } = new URL(req.url);
  const checkInRaw = searchParams.get('checkIn');
  const checkOutRaw = searchParams.get('checkOut');
  const guests = parseGuests(searchParams.get('guests'));

  if (!checkInRaw || !checkOutRaw) {
    return NextResponse.json({ error: 'checkIn y checkOut son requeridos' }, { status: 400 });
  }

  const checkIn = new Date(checkInRaw);
  const checkOut = new Date(checkOutRaw);
  if (Number.isNaN(checkIn.getTime()) || Number.isNaN(checkOut.getTime()) || checkOut <= checkIn) {
    return NextResponse.json({ error: 'Rango de fechas invalido' }, { status: 400 });
  }

  const availability = await checkListingAvailability({
    listingId: params.id,
    checkIn,
    checkOut,
    guests
  });

  return NextResponse.json(availability);
}
