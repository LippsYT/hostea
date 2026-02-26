'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';

type DebugRole = 'host' | 'client';

type DebugResponse = {
  role: DebugRole;
  status: {
    enabled: boolean;
    activeDevices: number;
    vapidPublicKey: string;
  };
  rows: Array<{
    id: string;
    endpoint: string;
    isActive: boolean;
    createdAt: string;
    lastSeenAt: string;
    userAgent: string | null;
  }>;
};

export const PushDebug = ({ roles }: { roles: string[] }) => {
  const roleOptions = useMemo(() => {
    const options: DebugRole[] = [];
    if (roles.includes('HOST') || roles.includes('ADMIN')) options.push('host');
    if (roles.includes('CLIENT') || roles.includes('ADMIN')) options.push('client');
    return options;
  }, [roles]);

  const [role, setRole] = useState<DebugRole>(roleOptions[0] || 'client');
  const [csrf, setCsrf] = useState('');
  const [debug, setDebug] = useState<DebugResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState('');
  const [browserState, setBrowserState] = useState({
    serviceWorker: false,
    permission: 'unknown',
    hasSubscription: false
  });

  const refresh = async () => {
    setLoading(true);
    setMessage('');
    try {
      const [csrfRes, debugRes] = await Promise.all([
        fetch('/api/security/csrf'),
        fetch(`/api/push/debug?role=${role}`)
      ]);
      const csrfData = await csrfRes.json();
      setCsrf(csrfData.token || '');

      if (!debugRes.ok) {
        const error = await debugRes.json().catch(() => ({}));
        throw new Error(error?.error || 'No se pudo cargar debug');
      }
      setDebug(await debugRes.json());

      if (typeof window !== 'undefined') {
        let hasSubscription = false;
        if ('serviceWorker' in navigator) {
          const registration = await navigator.serviceWorker.getRegistration('/service-worker.js');
          if (registration) {
            const sub = await registration.pushManager.getSubscription();
            hasSubscription = Boolean(sub);
          }
        }
        setBrowserState({
          serviceWorker: 'serviceWorker' in navigator,
          permission: 'Notification' in window ? Notification.permission : 'unsupported',
          hasSubscription
        });
      }
    } catch (error: any) {
      setMessage(error?.message || 'Error al cargar debug');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh().catch(() => undefined);
  }, [role]);

  const sendTest = async () => {
    setTesting(true);
    setMessage('');
    try {
      const res = await fetch('/api/push/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrf
        },
        body: JSON.stringify({ role })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || 'No se pudo enviar test');
      }
      setMessage('Push de prueba enviado.');
      await refresh();
    } catch (error: any) {
      setMessage(error?.message || 'No se pudo enviar test');
    } finally {
      setTesting(false);
    }
  };

  if (!roleOptions.length) {
    return (
      <div className="surface-card">
        <p className="text-sm text-slate-600">Tu usuario no tiene rol cliente/host para debug de push.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="surface-card space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Debug push</h2>
            <p className="text-sm text-slate-500">Estado de navegador + estado en base de datos.</p>
          </div>
          <div className="flex items-center gap-2">
            <select
              className="h-10 rounded-2xl border border-slate-200 bg-white px-3 text-sm"
              value={role}
              onChange={(e) => setRole(e.target.value as DebugRole)}
            >
              {roleOptions.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
            <Button size="sm" variant="outline" onClick={refresh} disabled={loading}>
              {loading ? 'Actualizando...' : 'Actualizar'}
            </Button>
            <Button size="sm" onClick={sendTest} disabled={testing || loading}>
              {testing ? 'Enviando...' : 'Enviar push de prueba'}
            </Button>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Service worker</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">
              {browserState.serviceWorker ? 'Registrado' : 'No disponible'}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Permiso Notification</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{browserState.permission}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Subscription navegador</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">
              {browserState.hasSubscription ? 'Activa' : 'No encontrada'}
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-sm font-semibold text-slate-900">
            Filas push_subscriptions: {debug?.rows.length || 0}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Activas: {debug?.status.activeDevices || 0} · Notificaciones {debug?.status.enabled ? 'activas' : 'desactivadas'}
          </p>
          <div className="mt-3 space-y-2">
            {(debug?.rows || []).map((row) => (
              <div key={row.id} className="rounded-xl border border-slate-200 p-3 text-xs text-slate-600">
                <p className="font-semibold text-slate-800">
                  {row.isActive ? 'Activa' : 'Inactiva'} · {row.endpoint.slice(0, 55)}...
                </p>
                <p>Creada: {new Date(row.createdAt).toLocaleString('es-AR')}</p>
                <p>Ultimo seen: {new Date(row.lastSeenAt).toLocaleString('es-AR')}</p>
              </div>
            ))}
            {!debug?.rows.length && (
              <p className="text-xs text-slate-500">No hay suscripciones guardadas para este rol.</p>
            )}
          </div>
        </div>

        {message && <p className="text-sm font-medium text-slate-700">{message}</p>}
      </div>
    </div>
  );
};
