import { NextResponse } from 'next/server';
import { EmailOtpType } from '@supabase/supabase-js';
import { getSupabasePublicServerClient } from '@/lib/supabase-public';
import { markEmailAsVerified } from '@/lib/email-verification';

const toSignIn = (req: Request, query: string) =>
  NextResponse.redirect(new URL(`/auth/sign-in${query}`, req.url));

export async function GET(req: Request) {
  const url = new URL(req.url);
  const tokenHash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type');
  const code = url.searchParams.get('code');

  try {
    const supabase = getSupabasePublicServerClient();
    let email: string | undefined;

    if (tokenHash && type) {
      const { data, error } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: type as EmailOtpType
      });
      if (error) {
        console.error('auth-callback-verify-error', error.message);
        return toSignIn(req, '?error=confirmacion_invalida');
      }
      email = data.user?.email || undefined;
    } else if (code) {
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        console.error('auth-callback-code-error', error.message);
        return toSignIn(req, '?error=confirmacion_invalida');
      }
      email = data.user?.email || undefined;
    } else {
      return toSignIn(req, '?error=confirmacion_invalida');
    }

    if (!email) {
      return toSignIn(req, '?error=confirmacion_invalida');
    }

    await markEmailAsVerified(email);
    return toSignIn(req, '?confirmed=1');
  } catch (error: any) {
    console.error('auth-callback-fatal', error?.message || error);
    return toSignIn(req, '?error=confirmacion_invalida');
  }
}
