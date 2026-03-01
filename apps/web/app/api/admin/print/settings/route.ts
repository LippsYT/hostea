import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { assertCsrf } from '@/lib/csrf';
import { requireRole } from '@/lib/permissions';
import {
  getAdminPrintSettings,
  updateAdminPrintSettings
} from '@/lib/print-jobs';

const schema = z.object({
  autoPrintEnabled: z.coerce.boolean(),
  autoPrintOnlyPaid: z.coerce.boolean(),
  printerName: z.string().max(120).optional().nullable(),
  printerAgentIp: z.string().max(200).optional().nullable(),
  printApiKey: z.string().max(250).optional().nullable(),
  copies: z.coerce.number().int().min(1).max(10)
});

export async function GET() {
  try {
    await requireRole('ADMIN');
    const settings = await getAdminPrintSettings(prisma);
    return NextResponse.json({
      settings: {
        ...settings,
        printApiKey: null,
        hasPrintApiKey: settings.hasPrintApiKey
      }
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'No autorizado' }, { status: 403 });
  }
}

export async function POST(req: Request) {
  try {
    assertCsrf(req);
    await requireRole('ADMIN');
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Datos invalidos' }, { status: 400 });
    }
    await updateAdminPrintSettings(prisma, parsed.data);
    const settings = await getAdminPrintSettings(prisma);
    return NextResponse.json({
      settings: {
        ...settings,
        printApiKey: null,
        hasPrintApiKey: settings.hasPrintApiKey
      }
    });
  } catch (error: any) {
    const status = error?.message?.includes('autoriz') ? 403 : 500;
    return NextResponse.json({ error: error.message || 'Error' }, { status });
  }
}
