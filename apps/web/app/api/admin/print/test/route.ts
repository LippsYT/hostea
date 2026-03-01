import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/permissions';
import { assertCsrf } from '@/lib/csrf';
import { createPrintJob } from '@/lib/print-jobs';
import { sendPrintTestToAgent } from '@/lib/print-agent';

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
    try {
      await sendPrintTestToAgent(prisma);
      await prisma.printJob.update({
        where: { id: job.id },
        data: {
          status: 'printed',
          printedAt: new Date(),
          attempts: { increment: 1 },
          error: null
        }
      });
    } catch (dispatchError: any) {
      await prisma.printJob.update({
        where: { id: job.id },
        data: {
          status: 'failed',
          attempts: { increment: 1 },
          error: dispatchError?.message || 'No se pudo enviar al agente'
        }
      });
      throw dispatchError;
    }
    return NextResponse.json({ ok: true, jobId: job.id });
  } catch (error: any) {
    const status = error?.message?.includes('autoriz') ? 403 : 500;
    return NextResponse.json({ error: error.message || 'Error' }, { status });
  }
}
