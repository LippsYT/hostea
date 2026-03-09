'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type Props = {
  email: string;
};

export const AccountSecurityCard = ({ email }: Props) => {
  const [csrf, setCsrf] = useState('');

  const [emailForm, setEmailForm] = useState({
    currentPassword: '',
    newEmail: ''
  });
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [emailSuccess, setEmailSuccess] = useState('');

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');

  const [recoverLoading, setRecoverLoading] = useState(false);
  const [recoverError, setRecoverError] = useState('');
  const [recoverSuccess, setRecoverSuccess] = useState('');

  useEffect(() => {
    fetch('/api/security/csrf').then(async (res) => {
      const data = await res.json();
      setCsrf(data.token);
    });
  }, []);

  const changeEmail = async () => {
    setEmailError('');
    setEmailSuccess('');
    setEmailLoading(true);
    const res = await fetch('/api/account/security/change-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': csrf
      },
      body: JSON.stringify(emailForm)
    });
    const data = await res.json().catch(() => ({}));
    setEmailLoading(false);
    if (!res.ok) {
      setEmailError(data?.error || 'No se pudo cambiar el email.');
      return;
    }
    setEmailSuccess(data?.message || 'Te enviamos un correo para confirmar el cambio.');
    setEmailForm((prev) => ({ ...prev, currentPassword: '' }));
  };

  const changePassword = async () => {
    setPasswordError('');
    setPasswordSuccess('');
    setPasswordLoading(true);
    const res = await fetch('/api/account/security/change-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': csrf
      },
      body: JSON.stringify(passwordForm)
    });
    const data = await res.json().catch(() => ({}));
    setPasswordLoading(false);
    if (!res.ok) {
      setPasswordError(data?.error || 'No se pudo cambiar la password.');
      return;
    }
    setPasswordSuccess(data?.message || 'Password actualizada correctamente.');
    setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
  };

  const recoverPassword = async () => {
    setRecoverError('');
    setRecoverSuccess('');
    setRecoverLoading(true);
    const res = await fetch('/api/account/security/recover-password', {
      method: 'POST',
      headers: {
        'x-csrf-token': csrf
      }
    });
    const data = await res.json().catch(() => ({}));
    setRecoverLoading(false);
    if (!res.ok) {
      setRecoverError(data?.error || 'No se pudo enviar el correo de recuperacion.');
      return;
    }
    setRecoverSuccess(data?.message || 'Te enviamos un correo de recuperacion.');
  };

  return (
    <div className="surface-card space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Cuenta / Seguridad</h2>
        <p className="text-sm text-slate-500">Gestiona tu email, password y recuperacion de acceso.</p>
      </div>

      <div className="grid gap-4 rounded-2xl border border-slate-200 bg-white/80 p-4 md:grid-cols-2">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Email actual</p>
          <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">{email}</p>
        </div>
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Recuperacion</p>
          <Button size="sm" variant="outline" onClick={recoverPassword} disabled={recoverLoading}>
            {recoverLoading ? 'Enviando...' : 'Enviar correo de recuperacion'}
          </Button>
          {recoverError ? <p className="text-xs text-red-600">{recoverError}</p> : null}
          {recoverSuccess ? <p className="text-xs text-emerald-700">{recoverSuccess}</p> : null}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white/80 p-4">
          <p className="text-base font-semibold text-slate-900">Cambiar email</p>
          <p className="mt-1 text-xs text-slate-500">
            Te enviaremos un correo al nuevo email para confirmar el cambio.
          </p>
          <div className="mt-4 space-y-3">
            <Input
              type="password"
              placeholder="Password actual"
              value={emailForm.currentPassword}
              onChange={(e) =>
                setEmailForm((prev) => ({ ...prev, currentPassword: e.target.value }))
              }
            />
            <Input
              type="email"
              placeholder="Nuevo email"
              value={emailForm.newEmail}
              onChange={(e) =>
                setEmailForm((prev) => ({ ...prev, newEmail: e.target.value }))
              }
            />
            {emailError ? <p className="text-xs text-red-600">{emailError}</p> : null}
            {emailSuccess ? <p className="text-xs text-emerald-700">{emailSuccess}</p> : null}
            <Button
              size="sm"
              onClick={changeEmail}
              disabled={emailLoading || !emailForm.currentPassword || !emailForm.newEmail}
            >
              {emailLoading ? 'Guardando...' : 'Solicitar cambio de email'}
            </Button>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white/80 p-4">
          <p className="text-base font-semibold text-slate-900">Cambiar password</p>
          <p className="mt-1 text-xs text-slate-500">
            Por seguridad, debes ingresar tu password actual.
          </p>
          <div className="mt-4 space-y-3">
            <Input
              type="password"
              placeholder="Password actual"
              value={passwordForm.currentPassword}
              onChange={(e) =>
                setPasswordForm((prev) => ({ ...prev, currentPassword: e.target.value }))
              }
            />
            <Input
              type="password"
              placeholder="Nueva password (min. 8 caracteres)"
              value={passwordForm.newPassword}
              onChange={(e) =>
                setPasswordForm((prev) => ({ ...prev, newPassword: e.target.value }))
              }
            />
            <Input
              type="password"
              placeholder="Confirmar nueva password"
              value={passwordForm.confirmPassword}
              onChange={(e) =>
                setPasswordForm((prev) => ({ ...prev, confirmPassword: e.target.value }))
              }
            />
            {passwordError ? <p className="text-xs text-red-600">{passwordError}</p> : null}
            {passwordSuccess ? <p className="text-xs text-emerald-700">{passwordSuccess}</p> : null}
            <Button
              size="sm"
              onClick={changePassword}
              disabled={
                passwordLoading ||
                !passwordForm.currentPassword ||
                !passwordForm.newPassword ||
                !passwordForm.confirmPassword
              }
            >
              {passwordLoading ? 'Actualizando...' : 'Actualizar password'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
