'use client';

import { signIn } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Link from 'next/link';

export default function SignInPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [resetRequested, setResetRequested] = useState(false);
  const [invalidConfirmation, setInvalidConfirmation] = useState(false);
  const [emailNotVerified, setEmailNotVerified] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setConfirmed(params.get('confirmed') === '1');
    setResetRequested(params.get('reset') === '1');
    setInvalidConfirmation(params.get('error') === 'confirmacion_invalida');
    setEmailNotVerified(params.get('error') === 'EMAIL_NOT_VERIFIED');
  }, []);

  const getSafeRedirect = (rawUrl?: string | null) => {
    if (!rawUrl) return '/dashboard';
    try {
      const currentOrigin = window.location.origin;
      const parsed = new URL(rawUrl, currentOrigin);
      if (parsed.origin !== currentOrigin) return '/dashboard';
      return `${parsed.pathname}${parsed.search}${parsed.hash}` || '/dashboard';
    } catch {
      return '/dashboard';
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const res = await signIn('credentials', {
      email,
      password,
      callbackUrl: '/dashboard',
      redirect: false
    });
    setLoading(false);
    if (!res) {
      setError('No se pudo iniciar sesión. Intenta de nuevo.');
      return;
    }
    if (res.error) {
      if (res.error === 'EMAIL_NOT_VERIFIED') {
        setError('Debes confirmar tu email antes de ingresar.');
      } else if (res.error === 'RATE_LIMIT') {
        setError('Demasiados intentos. Intenta nuevamente en un minuto.');
      } else {
        setError('Credenciales incorrectas o problema de servidor.');
      }
      return;
    }
    window.location.href = getSafeRedirect(res.url);
  };

  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center px-6">
      <form onSubmit={onSubmit} className="w-full max-w-md rounded-3xl bg-white p-8 shadow-soft">
        <Link href="/" className="inline-flex items-center text-sm text-neutral-500 hover:text-neutral-800">
          ← Volver al inicio
        </Link>
        <h1 className="text-2xl font-semibold">Ingresar</h1>
        <p className="mt-2 text-sm text-neutral-500">Accede con tus credenciales.</p>
        {confirmed && (
          <p className="mt-3 rounded-2xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            Email confirmado. Ya puedes ingresar.
          </p>
        )}
        {resetRequested && (
          <p className="mt-3 rounded-2xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            Revisa tu correo para continuar con la recuperacion de password.
          </p>
        )}
        {invalidConfirmation && (
          <p className="mt-3 rounded-2xl bg-red-50 px-3 py-2 text-sm text-red-600">
            El enlace de confirmacion no es valido o expiró.
          </p>
        )}
        {emailNotVerified && (
          <p className="mt-3 rounded-2xl bg-amber-50 px-3 py-2 text-sm text-amber-700">
            Debes confirmar tu email para publicar o acceder a funciones completas.
          </p>
        )}
        <div className="mt-6 space-y-4">
          <Input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <div className="text-right">
            <Link href="/auth/reset-password" className="text-xs text-neutral-500 hover:text-neutral-900">
              Olvide mi password
            </Link>
          </div>
          {error && <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Ingresando...' : 'Ingresar'}
          </Button>
        </div>
        <p className="mt-6 text-sm text-neutral-500">
          No tenes cuenta? <Link href="/auth/sign-up" className="text-neutral-900">Crear cuenta</Link>
        </p>
      </form>
    </div>
  );
}
