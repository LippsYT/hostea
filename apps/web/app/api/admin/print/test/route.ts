import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/permissions';
import { assertCsrf } from '@/lib/csrf';
import { createPrintJob } from '@/lib/print-jobs';

export async function POST(req: Request) {
  try {
    assertCsrf(req);
    await requireRole('ADMIN');
    const now = new Date();
    const job = await createPrintJob(prisma, {
      type: 'test',
      payload: {
        title: 'HOSTEA - PRUEBA',
        datetime: now.toISOString(),
        lines: [
          'Impresora conectada correctamente.',
          'Este es un ticket de prueba.',
          `Hora: ${now.toLocaleString('es-AR')}`
        ]
      }
    });
    return NextResponse.json({ ok: true, jobId: job.id });
  } catch (error: any) {
    const status = error?.message?.includes('autoriz') ? 403 : 500;
    return NextResponse.json({ error: error.message || 'Error' }, { status });
  }
}

