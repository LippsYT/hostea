'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Link from 'next/link';

export default function SignUpPage() {
  const [csrf, setCsrf] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptPrivacy, setAcceptPrivacy] = useState(false);
  const [acceptLiability, setAcceptLiability] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/security/csrf').then(async (res) => {
      const data = await res.json();
      setCsrf(data.token);
    });
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!acceptTerms || !acceptPrivacy || !acceptLiability) {
      setError('Debes aceptar Terminos, Privacidad y Limitacion de Responsabilidad.');
      return;
    }
    setSaving(true);
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': csrf
      },
      body: JSON.stringify({
        name,
        email,
        password,
        legalAcceptance: {
          terms: acceptTerms,
          privacy: acceptPrivacy,
          liability: acceptLiability
        }
      })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setSaving(false);
      setError(data?.error || 'No se pudo crear la cuenta');
      return;
    }
    window.location.href = '/auth/sign-in';
  };

  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center px-6">
      <form onSubmit={onSubmit} className="w-full max-w-md rounded-3xl bg-white p-8 shadow-soft">
        <h1 className="text-2xl font-semibold">Crear cuenta</h1>
        <p className="mt-2 text-sm text-neutral-500">Registrate para reservar.</p>
        <div className="mt-6 space-y-4">
          <Input placeholder="Nombre" value={name} onChange={(e) => setName(e.target.value)} />
          <Input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <div className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
            <label className="flex items-start gap-2">
              <input type="checkbox" checked={acceptTerms} onChange={(e) => setAcceptTerms(e.target.checked)} />
              <span>
                Acepto los <Link href="/legal/terminos-condiciones" className="font-semibold text-slate-900">Terminos y Condiciones</Link>.
              </span>
            </label>
            <label className="flex items-start gap-2">
              <input type="checkbox" checked={acceptPrivacy} onChange={(e) => setAcceptPrivacy(e.target.checked)} />
              <span>
                Acepto la <Link href="/legal/politica-privacidad" className="font-semibold text-slate-900">Politica de Privacidad</Link>.
              </span>
            </label>
            <label className="flex items-start gap-2">
              <input type="checkbox" checked={acceptLiability} onChange={(e) => setAcceptLiability(e.target.checked)} />
              <span>
                Acepto la <Link href="/legal/limitacion-responsabilidad" className="font-semibold text-slate-900">Limitacion de Responsabilidad</Link>.
              </span>
            </label>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" className="w-full" disabled={saving}>{saving ? 'Creando...' : 'Crear cuenta'}</Button>
        </div>
        <p className="mt-6 text-sm text-neutral-500">
          Ya tenes cuenta? <Link href="/auth/sign-in" className="text-neutral-900">Ingresar</Link>
        </p>
      </form>
    </div>
  );
}
