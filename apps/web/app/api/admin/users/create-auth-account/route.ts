import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/permissions';
import { assertCsrf } from '@/lib/csrf';
import { supabaseAdmin } from '@/lib/supabase';
import {
  buildSupabaseAuthIndex,
  listSupabaseAuthUsers,
  resolveSupabaseAuthForLocalUser
} from '@/lib/supabase-auth-users';

const schema = z.object({
  userId: z.string().min(1),
  emailConfirm: z.boolean().optional()
});

export async function POST(req: Request) {
  try {
    assertCsrf(req);
    const session = await requireRole('ADMIN');
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'Falta SUPABASE_SERVICE_ROLE_KEY en el servidor.' }, { status: 500 });
    }

    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Datos invalidos' }, { status: 400 });
    }

    const localUser = await prisma.user.findUnique({
      where: { id: parsed.data.userId },
      select: { id: true, email: true, emailVerified: true, profile: { select: { name: true } } }
    });

    if (!localUser) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    const supabaseUsers = await listSupabaseAuthUsers();
    const index = buildSupabaseAuthIndex(supabaseUsers);
    const existing = resolveSupabaseAuthForLocalUser({ id: localUser.id, email: localUser.email }, index);

    if (existing.status !== 'missing' && existing.user) {
      return NextResponse.json(
        {
          error: 'La cuenta ya existe en Supabase Auth.',
          authStatus: existing.status,
          supabaseUserId: existing.user.id
        },
        { status: 409 }
      );
    }

    const emailConfirm = Boolean(parsed.data.emailConfirm);
    const provisionalPassword = crypto.randomBytes(24).toString('hex');
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: localUser.email,
      password: provisionalPassword,
      email_confirm: emailConfirm,
      user_metadata: {
        internal_user_id: localUser.id,
        name: localUser.profile?.name || localUser.email.split('@')[0]
      }
    });

    if (error || !data.user) {
      return NextResponse.json(
        { error: error?.message || 'No se pudo crear la cuenta en Supabase Auth.' },
        { status: 500 }
      );
    }

    if (emailConfirm && !localUser.emailVerified) {
      await prisma.user.update({
        where: { id: localUser.id },
        data: { emailVerified: new Date() }
      });
    }

    await prisma.auditLog.create({
      data: {
        actorId: (session.user as any).id,
        action: 'USER_AUTH_CREATE_MANUAL',
        entity: 'User',
        entityId: localUser.id,
        meta: { email: localUser.email, supabaseUserId: data.user.id, emailConfirm }
      }
    });

    return NextResponse.json({
      ok: true,
      userId: localUser.id,
      email: localUser.email,
      supabaseUserId: data.user.id,
      authStatus: emailConfirm ? 'confirmed' : 'pending'
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Error' }, { status: 500 });
  }
}

