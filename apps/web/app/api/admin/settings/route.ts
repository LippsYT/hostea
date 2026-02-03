import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { requireRole } from '@/lib/permissions';
import { assertCsrf } from '@/lib/csrf';

export async function POST(req: Request) {
  try {
    assertCsrf(req);
    const session = await requireRole('ADMIN');
    const body = (await req.json()) as Array<{ key: string; value: unknown }>;

    for (const { key, value } of body) {
      const safeValue = JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
      await prisma.settings.upsert({
        where: { key },
        update: { value: safeValue },
        create: { key, value: safeValue }
      });
    }

    await prisma.auditLog.create({
      data: {
        actorId: (session.user as any).id,
        action: 'SETTINGS_UPDATE',
        entity: 'Settings',
        entityId: 'global',
        meta: { keys: body.map(({ key }) => key) }
      }
    });

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'No autorizado' }, { status: 401 });
  }
}
