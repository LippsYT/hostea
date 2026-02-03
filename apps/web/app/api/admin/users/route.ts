import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/permissions';
import { assertCsrf } from '@/lib/csrf';
import { z } from 'zod';
import { RoleName } from '@prisma/client';

const schema = z.object({
  userId: z.string(),
  role: z.nativeEnum(RoleName)
});

export async function GET() {
  await requireRole('ADMIN');
  const users = await prisma.user.findMany({
    include: { profile: true, roles: { include: { role: true } } },
    orderBy: { createdAt: 'desc' }
  });
  return NextResponse.json({ users });
}

export async function POST(req: Request) {
  try {
    assertCsrf(req);
    const session = await requireRole('ADMIN');
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: 'Datos invalidos' }, { status: 400 });

    const role = await prisma.role.findUnique({ where: { name: parsed.data.role } });
    if (!role) return NextResponse.json({ error: 'Rol no encontrado' }, { status: 404 });

    await prisma.$transaction([
      prisma.userRole.deleteMany({ where: { userId: parsed.data.userId } }),
      prisma.userRole.create({ data: { userId: parsed.data.userId, roleId: role.id } })
    ]);

    await prisma.auditLog.create({
      data: {
        actorId: (session.user as any).id,
        action: 'USER_ROLE_UPDATE',
        entity: 'User',
        entityId: parsed.data.userId,
        meta: { role: parsed.data.role }
      }
    });

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Error' }, { status: 500 });
  }
}
