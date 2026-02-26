import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireSession } from '@/lib/permissions';
import { assertCsrf } from '@/lib/csrf';
import { getPushStatus, savePushSubscription, setPushEnabled } from '@/lib/push-notifications';

const upsertSchema = z.object({
  endpoint: z.string().min(1),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1)
  }),
  userAgent: z.string().optional()
});

const toggleSchema = z.object({
  enabled: z.boolean()
});

const requireHostSession = async () => {
  const session = await requireSession();
  const roles = ((session.user as any).roles || []) as string[];
  if (!roles.includes('HOST') && !roles.includes('ADMIN')) {
    throw new Error('No autorizado');
  }
  return session;
};

export async function GET() {
  try {
    const session = await requireHostSession();
    const hostId = (session.user as any).id as string;
    const status = await getPushStatus(hostId, 'host');
    return NextResponse.json({
      ...status
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'No autorizado' }, { status: 401 });
  }
}

export async function POST(req: Request) {
  try {
    assertCsrf(req);
    const session = await requireHostSession();
    const hostId = (session.user as any).id as string;
    const parsed = upsertSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Suscripcion invalida' }, { status: 400 });
    }

    await savePushSubscription(
      hostId,
      'host',
      {
        endpoint: parsed.data.endpoint,
        p256dh: parsed.data.keys.p256dh,
        auth: parsed.data.keys.auth
      },
      parsed.data.userAgent || req.headers.get('user-agent') || undefined
    );
    await setPushEnabled(hostId, 'host', true);

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    if (error?.message === 'CSRF token invalido') {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: error.message || 'Error' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    assertCsrf(req);
    const session = await requireHostSession();
    const hostId = (session.user as any).id as string;
    const parsed = toggleSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Datos invalidos' }, { status: 400 });
    }
    await setPushEnabled(hostId, 'host', parsed.data.enabled);
    return NextResponse.json({ ok: true, enabled: parsed.data.enabled });
  } catch (error: any) {
    if (error?.message === 'CSRF token invalido') {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: error.message || 'Error' }, { status: 500 });
  }
}
