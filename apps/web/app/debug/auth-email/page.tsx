'use client';

import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { AuthTurnstile } from '@/components/auth-turnstile';

export default function AuthEmailDebugPage() {
  const [csrf, setCsrf] = useState('');
  const [email, setEmail] = useState('');
  const [captchaToken, setCaptchaToken] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch('/api/security/csrf').then(async (res) => {
      const data = await res.json();
      setCsrf(data.token);
    });
  }, []);

  const sendTest = async () => {
    setLoading(true);
    setStatus('');
    const res = await fetch('/api/auth/resend-confirmation', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': csrf
      },
      body: JSON.stringify({ email, captchaToken })
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setStatus(`Error: ${data?.error || 'No se pudo enviar'}`);
      return;
    }
    setStatus('OK: correo de confirmacion enviado');
  };

  return (
    <main className="mx-auto w-full max-w-xl space-y-4 px-6 py-10">
      <h1 className="text-2xl font-semibold text-slate-900">Debug SMTP de confirmacion</h1>
      <p className="text-sm text-slate-600">
        Esta accion prueba el envio del correo de confirmacion de Supabase.
      </p>
      <Input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="email@dominio.com"
      />
      <AuthTurnstile
        onToken={(token) => setCaptchaToken(token)}
        onExpire={() => setCaptchaToken('')}
      />
      <Button type="button" onClick={sendTest} disabled={loading || !email}>
        {loading ? 'Enviando...' : 'Enviar test de confirmacion'}
      </Button>
      {status && <p className="text-sm text-slate-700">{status}</p>}
    </main>
  );
}
