import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireSession } from '@/lib/permissions';
import { assertCsrf } from '@/lib/csrf';
import { z } from 'zod';

const patchSchema = z.object({
  id: z.string().optional(),
  markAll: z.boolean().optional()
});

export async function GET() {
  try {
    const session = await requireSession();
    const userId = (session.user as any).id as string;

    try {
      const notifications = await prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 50
      });

      return NextResponse.json({
        notifications,
        unreadCount: notifications.filter((notification) => !notification.readAt).length
      });
    } catch {
      return NextResponse.json({ notifications: [], unreadCount: 0 });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'No autorizado' }, { status: 401 });
  }
}

export async function PATCH(req: Request) {
  try {
    assertCsrf(req);
    const session = await requireSession();
    const userId = (session.user as any).id as string;
    const parsed = patchSchema.safeParse(await req.json());

    if (!parsed.success) {
      return NextResponse.json({ error: 'Datos invalidos' }, { status: 400 });
    }

    if (parsed.data.markAll) {
      try {
        await prisma.notification.updateMany({
          where: { userId, readAt: null },
          data: { readAt: new Date() }
        });
      } catch {
        return NextResponse.json({ ok: true });
      }
      return NextResponse.json({ ok: true });
    }

    if (!parsed.data.id) {
      return NextResponse.json({ error: 'Falta id' }, { status: 400 });
    }

    try {
      await prisma.notification.updateMany({
        where: { id: parsed.data.id, userId, readAt: null },
        data: { readAt: new Date() }
      });
    } catch {
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'No autorizado' }, { status: 401 });
  }
}
