import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/permissions';
import { assertCsrf } from '@/lib/csrf';
import { z } from 'zod';

const schema = z.object({
  slug: z.string(),
  title: z.string(),
  content: z.string()
});

export async function POST(req: Request) {
  try {
    assertCsrf(req);
    const session = await requireRole('ADMIN');
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: 'Datos invalidos' }, { status: 400 });

    const page = await prisma.legalPage.upsert({
      where: { slug: parsed.data.slug },
      update: { title: parsed.data.title, content: parsed.data.content },
      create: parsed.data
    });


    await prisma.auditLog.create({
      data: {
        actorId: (session.user as any).id,
        action: 'LEGAL_UPDATE',
        entity: 'LegalPage',
        entityId: parsed.data.slug,
        meta: { title: parsed.data.title }
      }
    });

    return NextResponse.json({ page });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'No autorizado' }, { status: 401 });
  }
}
