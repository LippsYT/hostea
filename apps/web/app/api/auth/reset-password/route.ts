import { NextResponse } from 'next/server';
import { z } from 'zod';
import { assertCsrf } from '@/lib/csrf';
import { rateLimit } from '@/lib/rate-limit';
import { verifyTurnstileToken } from '@/lib/captcha';
import { getAppBaseUrl, getSupabasePublicServerClient } from '@/lib/supabase-public';

const schema = z.object({
  email: z.string().email(),
  captchaToken: z.string().optional()
});

const getRequestIp = (req: Request) => {
  const forwardedFor = req.headers.get('x-forwarded-for') || '';
  return forwardedFor.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown';
};

export async function POST(req: Request) {
  try {
    assertCsrf(req);
    const ip = getRequestIp(req);
    const ok = await rateLimit(`auth:reset:${ip}`, 5, 60);
    if (!ok) return NextResponse.json({ error: 'Rate limit' }, { status: 429 });

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: 'Datos invalidos' }, { status: 400 });

    const captcha = await verifyTurnstileToken(parsed.data.captchaToken, ip);
    if (!captcha.ok) {
      return NextResponse.json({ error: captcha.reason || 'Captcha invalido' }, { status: 400 });
    }

    const supabase = getSupabasePublicServerClient();
    const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
      redirectTo: `${getAppBaseUrl(req)}/auth/sign-in?reset=1`
    });

    if (error) {
      console.error('reset-password-error', { email: parsed.data.email, message: error.message });
      return NextResponse.json(
        { error: `No se pudo enviar el correo de recuperacion: ${error.message}` },
        { status: 400 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: 'Si el email existe, te enviamos un enlace de recuperacion.'
    });
  } catch (error: any) {
    console.error('reset-password-fatal', error?.message || error);
    return NextResponse.json({ error: error.message || 'Error' }, { status: 500 });
  }
}
