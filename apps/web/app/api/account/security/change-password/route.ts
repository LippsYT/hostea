import { NextResponse } from 'next/server';
import { z } from 'zod';
import { hash } from 'bcryptjs';
import { assertCsrf } from '@/lib/csrf';
import { rateLimit } from '@/lib/rate-limit';
import { requireSession } from '@/lib/permissions';
import { prisma } from '@/lib/db';
import { getSupabasePublicServerClient } from '@/lib/supabase-public';

const schema = z
  .object({
    currentPassword: z.string().min(6),
    newPassword: z.string().min(8),
    confirmPassword: z.string().min(8)
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    message: 'Las passwords no coinciden.',
    path: ['confirmPassword']
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

    const ok = await rateLimit(`account:change-password:${userId}:${ip}`, 6, 60);
    if (!ok) return NextResponse.json({ error: 'Demasiados intentos. Intenta en un minuto.' }, { status: 429 });

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Datos invalidos.' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true }
    });
    if (!user) return NextResponse.json({ error: 'Usuario no encontrado.' }, { status: 404 });

    const supabase = getSupabasePublicServerClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: parsed.data.currentPassword
    });
    if (signInError) {
      return NextResponse.json({ error: 'Password actual incorrecta.' }, { status: 401 });
    }

    const { error: updateError } = await supabase.auth.updateUser({
      password: parsed.data.newPassword
    });
    await supabase.auth.signOut().catch(() => undefined);

    if (updateError) {
      return NextResponse.json({ error: updateError.message || 'No se pudo cambiar la password.' }, { status: 400 });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await hash(parsed.data.newPassword, 10) }
    });

    return NextResponse.json({
      ok: true,
      message: 'Password actualizada correctamente.'
    });
  } catch (error: any) {
    console.error('account-change-password-error', error?.message || error);
    return NextResponse.json({ error: error?.message || 'Error interno.' }, { status: 500 });
  }
}
