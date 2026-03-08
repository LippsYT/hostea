type CaptchaResult = {
  ok: boolean;
  reason?: string;
  skipped?: boolean;
};

export const verifyTurnstileToken = async (
  token: string | undefined,
  remoteIp?: string
): Promise<CaptchaResult> => {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    return { ok: true, skipped: true };
  }

  if (!token) {
    return { ok: false, reason: 'Captcha requerido' };
  }

  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        secret,
        response: token,
        remoteip: remoteIp || ''
      })
    });
    const data = (await response.json()) as { success?: boolean; 'error-codes'?: string[] };
    if (data?.success) return { ok: true };
    return {
      ok: false,
      reason: data?.['error-codes']?.join(', ') || 'Captcha invalido'
    };
  } catch {
    return { ok: false, reason: 'No se pudo validar captcha' };
  }
};
