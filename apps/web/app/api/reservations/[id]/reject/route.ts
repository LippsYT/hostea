import { NextResponse } from 'next/server';
import { assertCsrf } from '@/lib/csrf';
import { requireSession } from '@/lib/permissions';
import { rateLimit } from '@/lib/rate-limit';
import {
  clientRejectAwaitingPayment,
  expireAwaitingPaymentReservations
} from '@/lib/reservation-request-flow';

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  try {
    assertCsrf(_req);
    const session = await requireSession();
    const userId = (session.user as any).id as string;

    const ok = await rateLimit(`reservation:reject:${userId}`, 10, 60);
    if (!ok) {
      return NextResponse.json({ error: 'Rate limit' }, { status: 429 });
    }

    await expireAwaitingPaymentReservations();
    await clientRejectAwaitingPayment(params.id, userId);

    return NextResponse.json({ ok: true, status: 'rejected' });
  } catch (error: any) {
    const message = error?.message || 'No se pudo rechazar la solicitud';
    if (message === 'No autorizado') {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    if (message.includes('esperando pago')) {
      return NextResponse.json({ error: message }, { status: 409 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
