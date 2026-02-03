import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireSession } from '@/lib/permissions';
import { assertCsrf } from '@/lib/csrf';
import { calculateRefund } from '@/lib/pricing';
import { getSetting } from '@/lib/settings';
import { stripe } from '@/lib/stripe';
import { ReservationStatus } from '@prisma/client';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    assertCsrf(req);
    const session = await requireSession();
    const userId = (session.user as any).id;
    const roles = (session.user as any).roles as string[];

    const reservation = await prisma.reservation.findUnique({ where: { id: params.id }, include: { listing: true, payment: true } });
    if (!reservation) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
    if (reservation.userId !== userId && !roles.includes('ADMIN')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const windowHours = await getSetting<number>('cancelWindowHours', 48);
    const partialRefundPercent = await getSetting<number>('partialRefundPercent', 0.5);
    const refundRatio = calculateRefund({
      policy: reservation.listing.cancelPolicy,
      checkIn: reservation.checkIn,
      cancelAt: new Date(),
      windowHours,
      partialRefundPercent
    });

    if (refundRatio > 0 && reservation.payment?.stripePaymentIntentId) {
      await stripe.refunds.create({
        payment_intent: reservation.payment.stripePaymentIntentId,
        amount: Math.round(Number(reservation.total) * refundRatio * 100)
      });
    }

    await prisma.reservation.update({
      where: { id: reservation.id },
      data: { status: refundRatio > 0 ? ReservationStatus.REFUNDED : ReservationStatus.CANCELED }
    });

    return NextResponse.json({ refundRatio });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Error' }, { status: 500 });
  }
}
