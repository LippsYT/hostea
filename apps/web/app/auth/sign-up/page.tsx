'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Link from 'next/link';
import { AuthTurnstile } from '@/components/auth-turnstile';

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
  const [verifyMsg, setVerifyMsg] = useState('');
  const [step, setStep] = useState<'form' | 'verify'>('form');
  const [registeredEmail, setRegisteredEmail] = useState('');
  const [captchaToken, setCaptchaToken] = useState('');
  const [resending, setResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(30);
  const [resendMsg, setResendMsg] = useState('');

  useEffect(() => {
    fetch('/api/security/csrf').then(async (res) => {
      const data = await res.json();
      setCsrf(data.token);
    });
  }, []);

  useEffect(() => {
    if (step !== 'verify' || resendCooldown <= 0) return;
    const timer = window.setTimeout(() => {
      setResendCooldown((current) => Math.max(0, current - 1));
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [step, resendCooldown]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setResendMsg('');
    setVerifyMsg('');
    if (!acceptTerms || !acceptPrivacy || !acceptLiability) {
      setError('Debes aceptar Terminos, Privacidad y Limitacion de Responsabilidad.');
      return;
    }
    setSaving(true);
    try {
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
          captchaToken,
          legalAcceptance: {
            terms: acceptTerms,
            privacy: acceptPrivacy,
            liability: acceptLiability
          }
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || 'No se pudo crear la cuenta');
        return;
      }
      setRegisteredEmail(email.trim());
      setVerifyMsg(data?.message || 'Te enviamos un correo para confirmar tu cuenta.');
      setStep('verify');
      setResendCooldown(30);
    } catch {
      setError('No se pudo crear la cuenta. Revisa tu conexion.');
    } finally {
      setSaving(false);
    }
  };

  const onResend = async () => {
    if (!registeredEmail) {
      setError('Ingresa tu email para reenviar la confirmacion.');
      return;
    }
    setError('');
    setResendMsg('');
    setResending(true);
    try {
      const res = await fetch('/api/auth/resend-confirmation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrf
        },
        body: JSON.stringify({ email: registeredEmail })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || 'No se pudo reenviar el correo.');
        return;
      }
      setResendMsg(data?.message || 'Correo de confirmacion reenviado. Revisa tu bandeja.');
      setResendCooldown(30);
    } catch {
      setError('No se pudo reenviar el correo. Revisa tu conexion.');
    } finally {
      setResending(false);
    }
  };

  if (step === 'verify') {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center px-6">
        <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-soft">
          <h1 className="text-2xl font-semibold">Verifica tu correo</h1>
          <p className="mt-3 text-sm text-slate-700">
            {verifyMsg || 'Te enviamos un correo para confirmar tu cuenta.'}
          </p>
          <p className="mt-2 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700 break-all">
            {registeredEmail}
          </p>
          <p className="mt-3 text-sm text-slate-500">
            Revisa tu bandeja de entrada y tambien spam/promociones.
          </p>
          {resendMsg && <p className="mt-3 text-sm text-emerald-700">{resendMsg}</p>}
          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
          <div className="mt-6 space-y-3">
            <Button
              type="button"
              variant="primary"
              className="w-full"
              disabled={resending || resendCooldown > 0}
              onClick={onResend}
            >
              {resending
                ? 'Reenviando...'
                : resendCooldown > 0
                  ? `Reenviar en ${resendCooldown}s`
                  : 'Reenviar correo de confirmacion'}
            </Button>
            <Link href="/auth/sign-in" className="block">
              <Button type="button" variant="outline" className="w-full">
                Volver a iniciar sesion
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center px-6">
      <form onSubmit={onSubmit} className="w-full max-w-md rounded-3xl bg-white p-8 shadow-soft">
        <h1 className="text-2xl font-semibold">Crear cuenta</h1>
        <p className="mt-2 text-sm text-neutral-500">Registrate para reservar.</p>
        <div className="mt-6 space-y-4">
          <Input placeholder="Nombre" value={name} onChange={(e) => setName(e.target.value)} />
          <Input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <AuthTurnstile
            onToken={(token) => setCaptchaToken(token)}
            onExpire={() => setCaptchaToken('')}
          />
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
