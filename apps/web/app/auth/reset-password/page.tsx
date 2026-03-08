'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AuthTurnstile } from '@/components/auth-turnstile';

export default function ResetPasswordPage() {
  const [csrf, setCsrf] = useState('');
  const [email, setEmail] = useState('');
  const [captchaToken, setCaptchaToken] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetch('/api/security/csrf').then(async (res) => {
      const data = await res.json();
      setCsrf(data.token);
    });
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSaving(true);
    const res = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': csrf
      },
      body: JSON.stringify({ email, captchaToken })
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setError(data?.error || 'No se pudo enviar el correo.');
      return;
    }
    setSuccess(data?.message || 'Si el email existe, te enviamos un enlace de recuperacion.');
  };

  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center px-6">
      <form onSubmit={onSubmit} className="w-full max-w-md rounded-3xl bg-white p-8 shadow-soft">
        <Link href="/auth/sign-in" className="inline-flex items-center text-sm text-neutral-500 hover:text-neutral-800">
          ← Volver a ingresar
        </Link>
        <h1 className="mt-3 text-2xl font-semibold">Recuperar password</h1>
        <p className="mt-2 text-sm text-neutral-500">Te enviaremos un correo para restablecer tu acceso.</p>
        <div className="mt-6 space-y-4">
          <Input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <AuthTurnstile
            onToken={(token) => setCaptchaToken(token)}
            onExpire={() => setCaptchaToken('')}
          />
          {error && <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}
          {success && (
            <p className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</p>
          )}
          <Button type="submit" className="w-full" disabled={saving}>
            {saving ? 'Enviando...' : 'Enviar correo'}
          </Button>
        </div>
      </form>
    </div>
  );
}
