import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/permissions';
import { assertCsrf } from '@/lib/csrf';
import { z } from 'zod';
import { KycStatus } from '@prisma/client';

const schema = z.object({
  status: z.nativeEnum(KycStatus),
  notes: z.string().optional()
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    assertCsrf(req);
    const session = await requireRole('ADMIN');
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: 'Datos invalidos' }, { status: 400 });

    const submission = await prisma.kycSubmission.update({
      where: { id: params.id },
      data: { status: parsed.data.status, notes: parsed.data.notes }
    });


    await prisma.auditLog.create({
      data: {
        actorId: (session.user as any).id,
        action: 'KYC_UPDATE',
        entity: 'KycSubmission',
        entityId: submission.id,
        meta: { status: parsed.data.status }
      }
    });

    return NextResponse.json({ submission });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'No autorizado' }, { status: 401 });
  }
}
