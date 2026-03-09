import { NextResponse } from 'next/server';
import { z } from 'zod';
import { assertCsrf } from '@/lib/csrf';
import { requireRole } from '@/lib/permissions';
import { sendReservationConfirmedEmails } from '@/lib/reservation-emails';
import { prisma } from '@/lib/db';

const schema = z.object({
  reservationId: z.string().min(8)
});

export async function POST(req: Request) {
  try {
    assertCsrf(req);
    await requireRole('ADMIN');
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Datos invalidos.' }, { status: 400 });
    }

    const result = await sendReservationConfirmedEmails(parsed.data.reservationId, prisma, {
      force: true
    });

    if (!result?.sent) {
      if (result?.reason === 'payment-not-succeeded') {
        return NextResponse.json(
          { error: 'La reserva aun no tiene pago acreditado.' },
          { status: 400 }
        );
      }
      if (result?.reason === 'email-error') {
        return NextResponse.json(
          { error: 'Fallo el envio del email. Revisa la configuracion de Resend.' },
          { status: 502 }
        );
      }
      if (result?.reason === 'not-confirmed') {
        return NextResponse.json(
          { error: 'La reserva aun no esta confirmada.' },
          { status: 400 }
        );
      }
      if (result?.reason === 'not-found') {
        return NextResponse.json({ error: 'Reserva no encontrada.' }, { status: 404 });
      }
      return NextResponse.json({ error: 'No se pudo reenviar el email.' }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('admin-resend-reservation-email-error', error?.message || error);
    return NextResponse.json({ error: error?.message || 'Error interno.' }, { status: 500 });
  }
}
