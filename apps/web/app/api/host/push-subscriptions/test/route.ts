import { NextResponse } from 'next/server';
import { assertCsrf } from '@/lib/csrf';
import { requireSession } from '@/lib/permissions';
import { sendPushToHost } from '@/lib/push-notifications';

export async function POST(req: Request) {
  try {
    assertCsrf(req);
    const session = await requireSession();
    const roles = ((session.user as any).roles || []) as string[];
    if (!roles.includes('HOST') && !roles.includes('ADMIN')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }
    const hostId = (session.user as any).id as string;
    const result = await sendPushToHost(hostId, {
      title: 'Notificacion de prueba',
      body: 'Si escuchas este aviso, las notificaciones push estan activas.',
      url: '/dashboard/host/messages',
      type: 'TEST'
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
