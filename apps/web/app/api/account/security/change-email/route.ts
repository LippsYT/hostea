import { NextResponse } from 'next/server';
import { z } from 'zod';
import { assertCsrf } from '@/lib/csrf';
import { rateLimit } from '@/lib/rate-limit';
import { requireSession } from '@/lib/permissions';
import { prisma } from '@/lib/db';
import { getAppBaseUrl, getSupabasePublicServerClient } from '@/lib/supabase-public';

const schema = z.object({
  currentPassword: z.string().min(6),
  newEmail: z.string().email()
});

const getRequestIp = (req: Request) => {
  const forwardedFor = req.headers.get('x-forwarded-for') || '';
  return forwardedFor.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown';
};

export async function POST(req: Request) {
  try {
    assertCsrf(req);
    const session = await requireSession();
    const userId = (session.user as any).id as string;
    const ip = getRequestIp(req);

    const ok = await rateLimit(`account:change-email:${userId}:${ip}`, 5, 60);
    if (!ok) return NextResponse.json({ error: 'Demasiados intentos. Intenta en un minuto.' }, { status: 429 });

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Datos invalidos.' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true }
    });
    if (!user) return NextResponse.json({ error: 'Usuario no encontrado.' }, { status: 404 });

    const newEmail = parsed.data.newEmail.trim().toLowerCase();
    if (newEmail === user.email.toLowerCase()) {
      return NextResponse.json({ error: 'El nuevo email no puede ser igual al actual.' }, { status: 400 });
    }

    const emailUsed = await prisma.user.findFirst({
      where: { email: { equals: newEmail, mode: 'insensitive' }, NOT: { id: user.id } },
      select: { id: true }
    });
    if (emailUsed) {
      return NextResponse.json({ error: 'Ese email ya esta en uso.' }, { status: 409 });
    }

    const supabase = getSupabasePublicServerClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: parsed.data.currentPassword
    });
    if (signInError) {
      return NextResponse.json({ error: 'Password actual incorrecta.' }, { status: 401 });
    }

    const { error: updateError } = await supabase.auth.updateUser(
      { email: newEmail },
      { emailRedirectTo: `${getAppBaseUrl(req)}/auth/callback` }
    );
    await supabase.auth.signOut().catch(() => undefined);

    if (updateError) {
      return NextResponse.json({ error: updateError.message || 'No se pudo cambiar el email.' }, { status: 400 });
    }

    await prisma.settings.upsert({
      where: { key: `pendingEmailChange:${newEmail}` },
      update: {
        value: {
          userId: user.id,
          previousEmail: user.email,
          requestedAt: new Date().toISOString()
        }
      },
      create: {
        key: `pendingEmailChange:${newEmail}`,
        value: {
          userId: user.id,
          previousEmail: user.email,
          requestedAt: new Date().toISOString()
        }
      }
    });

    return NextResponse.json({
      ok: true,
      message: `Te enviamos un correo a ${newEmail} para confirmar el cambio de email.`
    });
  } catch (error: any) {
    console.error('account-change-email-error', error?.message || error);
    return NextResponse.json({ error: error?.message || 'Error interno.' }, { status: 500 });
  }
}
