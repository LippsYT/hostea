import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { assertCsrf } from '@/lib/csrf';
import { requireSession } from '@/lib/permissions';

const schema = z.object({
  checkIn: z.string().min(1),
  checkOut: z.string().min(1),
  timeLabel: z.string().optional(),
  adults: z.coerce.number().int().min(1).max(30),
  children: z.coerce.number().int().min(0).max(30),
  infants: z.coerce.number().int().min(0).max(30)
});

const ACTIVE_BOOKING_STATUSES = ['CONFIRMED', 'PENDING_APPROVAL', 'AWAITING_PAYMENT'];

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    assertCsrf(req);
    const session = await requireSession();
    const userId = (session.user as any)?.id as string;
    if (!userId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Datos invalidos' }, { status: 400 });
    }

    const experience = await prisma.experience.findFirst({
      where: { id: params.id, status: 'ACTIVE' }
    });
    if (!experience) {
      return NextResponse.json({ error: 'Experiencia no encontrada' }, { status: 404 });
    }

    const data = parsed.data;
    const checkInDate = new Date(data.checkIn);
    const checkOutDate = new Date(data.checkOut);
    if (Number.isNaN(checkInDate.getTime()) || Number.isNaN(checkOutDate.getTime())) {
      return NextResponse.json({ error: 'Fechas invalidas' }, { status: 400 });
    }
    if (checkOutDate < checkInDate) {
      return NextResponse.json({ error: 'Check-out no puede ser menor que check-in' }, { status: 400 });
    }

    const totalGuests = data.adults + data.children + data.infants;
    if (totalGuests > experience.capacity) {
      return NextResponse.json(
        { error: `La actividad admite hasta ${experience.capacity} personas.` },
        { status: 400 }
      );
    }

    const occupied = await prisma.experienceBooking.aggregate({
      where: {
        experienceId: experience.id,
        date: checkInDate,
        timeLabel: data.timeLabel || undefined,
        status: { in: ACTIVE_BOOKING_STATUSES }
      },
      _sum: {
        adults: true,
        children: true,
        infants: true
      }
    });

    const occupiedCount =
      Number(occupied._sum.adults || 0) +
      Number(occupied._sum.children || 0) +
      Number(occupied._sum.infants || 0);

    if (experience.activityType === 'SHARED' && occupiedCount + totalGuests > experience.capacity) {
      return NextResponse.json(
        { error: 'No hay cupos suficientes para la fecha y horario elegidos.' },
        { status: 400 }
      );
    }

    const adultPrice = Number(experience.pricePerPerson);
    const childPrice = Number(experience.childPrice ?? experience.pricePerPerson);
    const infantPrice = Number(experience.infantPrice ?? 0);
    const total =
      data.adults * adultPrice + data.children * childPrice + data.infants * infantPrice;

    const status = experience.activityType === 'PRIVATE' ? 'PENDING_APPROVAL' : 'CONFIRMED';
    const booking = await prisma.experienceBooking.create({
      data: {
        experienceId: experience.id,
        userId,
        date: checkInDate,
        timeLabel:
          data.timeLabel ||
          `${data.checkIn}${data.checkOut && data.checkOut !== data.checkIn ? ` -> ${data.checkOut}` : ''}`,
        adults: data.adults,
        children: data.children,
        infants: data.infants,
        total,
        currency: 'USD',
        status
      }
    });

    return NextResponse.json({ bookingId: booking.id, status });
  } catch (error: any) {
    if (error?.message === 'CSRF token invalido') {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: error?.message || 'Error' }, { status: 500 });
  }
}
