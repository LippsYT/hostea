import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/permissions';
import { assertCsrf } from '@/lib/csrf';
import { createPrintJob } from '@/lib/print-jobs';

const schema = z.object({
  jobId: z.string().min(8)
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

    const source = await prisma.printJob.findUnique({
      where: { id: parsed.data.jobId }
    });
    if (!source) {
      return NextResponse.json({ error: 'Trabajo no encontrado' }, { status: 404 });
    }

    const job = await createPrintJob(prisma, {
      type: source.type,
      reservationId: source.reservationId,
      hostId: source.hostId,
      payload: source.payload as Record<string, unknown>
    });

    return NextResponse.json({ ok: true, jobId: job.id });
  } catch (error: any) {
    const status = error?.message?.includes('autoriz') ? 403 : 500;
    return NextResponse.json({ error: error.message || 'Error' }, { status });
  }
}

