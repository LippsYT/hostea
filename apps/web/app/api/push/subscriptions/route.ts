import { NextResponse } from 'next/server';
import { z } from 'zod';
import { assertCsrf } from '@/lib/csrf';
import { requireSession } from '@/lib/permissions';
import {
  getPushStatus,
  PushUserRole,
  removePushSubscription,
  savePushSubscription,
  setPushEnabled
} from '@/lib/push-notifications';

const roleSchema = z.enum(['host', 'client']);

const upsertSchema = z.object({
  role: roleSchema,
  endpoint: z.string().min(1),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1)
  }),
  userAgent: z.string().optional()
});

const toggleSchema = z.object({
  role: roleSchema,
  enabled: z.boolean()
});

const deleteSchema = z.object({
  role: roleSchema,
  endpoint: z.string().optional(),
  disable: z.boolean().optional()
});

const canUseRole = (sessionRoles: string[], role: PushUserRole) => {
  if (sessionRoles.includes('ADMIN')) return true;
  if (role === 'host') return sessionRoles.includes('HOST');
  return sessionRoles.includes('CLIENT');
};

const resolveRoleFromQuery = (req: Request, sessionRoles: string[]): PushUserRole => {
  const url = new URL(req.url);
  const raw = url.searchParams.get('role');
  if (raw === 'host' || raw === 'client') return raw;
  if (sessionRoles.includes('HOST') || sessionRoles.includes('ADMIN')) return 'host';
  return 'client';
};

export async function GET(req: Request) {
  try {
    const session = await requireSession();
    const userId = (session.user as any).id as string;
    const roles = (((session.user as any).roles || []) as string[]);
    const role = resolveRoleFromQuery(req, roles);
    if (!canUseRole(roles, role)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }
    const status = await getPushStatus(userId, role);
    return NextResponse.json({ role, ...status });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'No autorizado' }, { status: 401 });
  }
}

export async function POST(req: Request) {
  try {
    assertCsrf(req);
    const session = await requireSession();
    const userId = (session.user as any).id as string;
    const roles = (((session.user as any).roles || []) as string[]);
    const parsed = upsertSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Suscripcion invalida' }, { status: 400 });
    }
    if (!canUseRole(roles, parsed.data.role)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    await savePushSubscription(
      userId,
      parsed.data.role,
      {
        endpoint: parsed.data.endpoint,
        p256dh: parsed.data.keys.p256dh,
        auth: parsed.data.keys.auth
      },
      parsed.data.userAgent || req.headers.get('user-agent') || undefined
    );
    await setPushEnabled(userId, parsed.data.role, true);

    const status = await getPushStatus(userId, parsed.data.role);
    return NextResponse.json({ role: parsed.data.role, ...status });
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
    const session = await requireSession();
    const userId = (session.user as any).id as string;
    const roles = (((session.user as any).roles || []) as string[]);
    const parsed = toggleSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Datos invalidos' }, { status: 400 });
    }
    if (!canUseRole(roles, parsed.data.role)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    await setPushEnabled(userId, parsed.data.role, parsed.data.enabled);
    const status = await getPushStatus(userId, parsed.data.role);
    return NextResponse.json({ role: parsed.data.role, ...status });
  } catch (error: any) {
    if (error?.message === 'CSRF token invalido') {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: error.message || 'Error' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    assertCsrf(req);
    const session = await requireSession();
    const userId = (session.user as any).id as string;
    const roles = (((session.user as any).roles || []) as string[]);
    const parsed = deleteSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Datos invalidos' }, { status: 400 });
    }
    if (!canUseRole(roles, parsed.data.role)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    await removePushSubscription(userId, parsed.data.role, parsed.data.endpoint);
    if (parsed.data.disable) {
      await setPushEnabled(userId, parsed.data.role, false);
    }

    const status = await getPushStatus(userId, parsed.data.role);
    return NextResponse.json({ role: parsed.data.role, ...status });
  } catch (error: any) {
    if (error?.message === 'CSRF token invalido') {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: error.message || 'Error' }, { status: 500 });
  }
}
