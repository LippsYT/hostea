import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/permissions';
import { assertCsrf } from '@/lib/csrf';
import { supabaseAdmin } from '@/lib/supabase';

const schema = z.object({
  userId: z.string().min(1)
});

const findSupabaseUserIdByEmail = async (email: string) => {
  const normalizedEmail = email.trim().toLowerCase();
  const perPage = 200;
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(error.message || 'No se pudo listar usuarios en Supabase.');

    const matched = data.users.find((user) => user.email?.toLowerCase() === normalizedEmail);
    if (matched) return matched.id;
    if (data.users.length < perPage) break;
  }
  return null;
};

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
      select: { id: true, email: true, emailVerified: true }
    });

    if (!localUser) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    const supabaseUserId = await findSupabaseUserIdByEmail(localUser.email);
    if (!supabaseUserId) {
      return NextResponse.json({ error: 'No se encontro el usuario en Supabase Auth.' }, { status: 404 });
    }

    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(supabaseUserId, {
      email_confirm: true
    });

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message || 'No se pudo confirmar el email en Supabase.' },
        { status: 500 }
      );
    }

    if (!localUser.emailVerified) {
      await prisma.user.update({
        where: { id: localUser.id },
        data: { emailVerified: new Date() }
      });
    }

    await prisma.auditLog.create({
      data: {
        actorId: (session.user as any).id,
        action: 'USER_EMAIL_CONFIRM_MANUAL',
        entity: 'User',
        entityId: localUser.id,
        meta: { email: localUser.email, supabaseUserId }
      }
    });

    return NextResponse.json({ ok: true, userId: localUser.id, email: localUser.email });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Error' }, { status: 500 });
  }
}

