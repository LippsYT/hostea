import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/permissions';
import { assertCsrf } from '@/lib/csrf';
import { buildReservationPrintPayload, createPrintJob } from '@/lib/print-jobs';

const schema = z.object({
  reservationId: z.string().min(8)
});

export async function POST(req: Request) {
  try {
    assertCsrf(req);
    await requireRole('ADMIN');
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Datos invalidos' }, { status: 400 });
    }

    const payload = await buildReservationPrintPayload(prisma, parsed.data.reservationId);
    if (!payload) {
      return NextResponse.json({ error: 'Reserva no encontrada' }, { status: 404 });
    }

    const job = await createPrintJob(prisma, {
      type: 'reservation',
      reservationId: parsed.data.reservationId,
      hostId: payload.hostId,
      payload: { ...payload, trigger: 'manual_reprint' }
    });

    return NextResponse.json({ ok: true, jobId: job.id });
  } catch (error: any) {
    const status = error?.message?.includes('autoriz') ? 403 : 500;
    return NextResponse.json({ error: error.message || 'Error' }, { status });
  }
}

