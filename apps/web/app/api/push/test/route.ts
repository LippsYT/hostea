import { NextResponse } from 'next/server';
import { z } from 'zod';
import { assertCsrf } from '@/lib/csrf';
import { requireSession } from '@/lib/permissions';
import { PushUserRole, sendPushToUser } from '@/lib/push-notifications';

const schema = z.object({
  role: z.enum(['host', 'client'])
});

const isAllowedRole = (roles: string[], role: PushUserRole) => {
  if (roles.includes('ADMIN')) return true;
  if (role === 'host') return roles.includes('HOST');
  return roles.includes('CLIENT');
};

export async function POST(req: Request) {
  try {
    assertCsrf(req);
    const session = await requireSession();
    const userId = (session.user as any).id as string;
    const roles = (((session.user as any).roles || []) as string[]);
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Datos invalidos' }, { status: 400 });
    }
    if (!isAllowedRole(roles, parsed.data.role)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const destination =
      parsed.data.role === 'host'
        ? '/dashboard/host/messages'
        : '/dashboard/client/messages';

    const result = await sendPushToUser(userId, parsed.data.role, {
      title: 'Notificacion de prueba',
      body: 'Hostea push activo. Si ves esto, la configuracion funciona.',
      url: destination,
      type: 'TEST_PUSH',
      tag: 'TEST_PUSH'
    });

    if (result.reason !== 'OK') {
      return NextResponse.json(
        { error: `No se pudo enviar push (${result.reason})`, result },
        { status: 400 }
      );
    }

    return NextResponse.json({ ok: true, result });
  } catch (error: any) {
    if (error?.message === 'CSRF token invalido') {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: error.message || 'Error' }, { status: 500 });
  }
}
