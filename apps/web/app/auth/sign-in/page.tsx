'use client';

import { signIn } from 'next-auth/react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Link from 'next/link';

export default function SignInPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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
      setError('Credenciales incorrectas o problema de servidor.');
      return;
    }
    window.location.href = res.url || '/dashboard';
  };

  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center px-6">
      <form onSubmit={onSubmit} className="w-full max-w-md rounded-3xl bg-white p-8 shadow-soft">
        <h1 className="text-2xl font-semibold">Ingresar</h1>
        <p className="mt-2 text-sm text-neutral-500">Accede con tus credenciales.</p>
        <div className="mt-6 space-y-4">
          <Input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
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
