import { NextResponse } from 'next/server';
import { assertCsrf } from '@/lib/csrf';
import { rateLimit } from '@/lib/rate-limit';
import { requireSession } from '@/lib/permissions';
import { prisma } from '@/lib/db';
import { getAppBaseUrl, getSupabasePublicServerClient } from '@/lib/supabase-public';

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

    const ok = await rateLimit(`account:recover-password:${userId}:${ip}`, 3, 60);
    if (!ok) return NextResponse.json({ error: 'Demasiados intentos. Intenta en un minuto.' }, { status: 429 });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true }
    });
    if (!user) return NextResponse.json({ error: 'Usuario no encontrado.' }, { status: 404 });

    const supabase = getSupabasePublicServerClient();
    const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
      redirectTo: `${getAppBaseUrl(req)}/auth/sign-in?reset=1`
    });

    if (error) {
      return NextResponse.json({ error: error.message || 'No se pudo enviar el correo.' }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      message: 'Te enviamos un correo para recuperar tu password.'
    });
  } catch (error: any) {
    console.error('account-recover-password-error', error?.message || error);
    return NextResponse.json({ error: error?.message || 'Error interno.' }, { status: 500 });
  }
}
