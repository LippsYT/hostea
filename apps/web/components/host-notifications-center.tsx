'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';

type PushStatus = {
  enabled: boolean;
  activeDevices: number;
  vapidPublicKey: string;
};

const urlBase64ToUint8Array = (base64String: string) => {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
};

export const HostNotificationsCenter = () => {
  const [csrf, setCsrf] = useState('');
  const [status, setStatus] = useState<PushStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState('');

  const permission = useMemo(
    () => (typeof window === 'undefined' || !('Notification' in window) ? 'unsupported' : Notification.permission),
    [status]
  );

  const loadStatus = async () => {
    const [csrfRes, statusRes] = await Promise.all([
      fetch('/api/security/csrf'),
      fetch('/api/host/push-subscriptions')
    ]);
    const csrfData = await csrfRes.json();
    setCsrf(csrfData.token || '');
    if (statusRes.ok) {
      const data = (await statusRes.json()) as PushStatus;
      setStatus(data);
    }
  };

  useEffect(() => {
    loadStatus().catch(() => undefined);
  }, []);

  const activateNotifications = async () => {
    if (!status?.vapidPublicKey) {
      setMessage('Falta configurar VAPID en el servidor.');
      return;
    }
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      setMessage('Tu navegador no soporta Web Push.');
      return;
    }

    setBusy(true);
    setMessage('');
    try {
      const permissionResult = await Notification.requestPermission();
      if (permissionResult !== 'granted') {
        setMessage('Permiso de notificaciones denegado.');
        return;
      }

      const registration = await navigator.serviceWorker.register('/service-worker.js');
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(status.vapidPublicKey)
        });
      }

      const res = await fetch('/api/host/push-subscriptions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrf
        },
        body: JSON.stringify({
          endpoint: subscription.endpoint,
          keys: subscription.toJSON().keys,
          userAgent: navigator.userAgent
        })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || 'No se pudo guardar la suscripcion');
      }

      await fetch('/api/host/push-subscriptions', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrf
        },
        body: JSON.stringify({ enabled: true })
      });

      setMessage('Notificaciones activadas.');
      await loadStatus();
    } catch (error: any) {
      setMessage(error?.message || 'No se pudieron activar las notificaciones');
    } finally {
      setBusy(false);
    }
  };

  const onToggle = async (enabled: boolean) => {
    setBusy(true);
    setMessage('');
    try {
      const res = await fetch('/api/host/push-subscriptions', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrf
        },
        body: JSON.stringify({ enabled })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || 'No se pudo actualizar');
      }
      setStatus((prev) => (prev ? { ...prev, enabled } : prev));
      setMessage(enabled ? 'Notificaciones activadas.' : 'Notificaciones desactivadas.');
    } catch (error: any) {
      setMessage(error?.message || 'No se pudo actualizar la preferencia');
    } finally {
      setBusy(false);
    }
  };

  const sendTest = async () => {
    setTesting(true);
    setMessage('');
    try {
      const res = await fetch('/api/host/push-subscriptions/test', {
        method: 'POST',
        headers: { 'x-csrf-token': csrf }
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || 'No se pudo enviar la prueba');
      }
      setMessage('Notificacion de prueba enviada. Revisa sonido y apertura del enlace.');
    } catch (error: any) {
      setMessage(error?.message || 'No se pudo enviar notificacion de prueba');
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="section-subtitle">Panel Host</p>
        <h1 className="section-title">Notificaciones</h1>
      </div>

      <div className="surface-card space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Centro de notificaciones</h2>
            <p className="text-sm text-slate-500">
              Recibe alertas push por mensajes, consultas, reservas y pagos confirmados.
            </p>
          </div>
          <Button size="sm" onClick={activateNotifications} disabled={busy}>
            {busy ? 'Activando...' : 'Activar notificaciones'}
          </Button>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Estado</p>
            <p className="mt-2 text-sm font-semibold text-slate-900">
              {status?.enabled ? 'Activas' : 'Desactivadas'}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Dispositivos</p>
            <p className="mt-2 text-sm font-semibold text-slate-900">{status?.activeDevices || 0}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Permiso navegador</p>
            <p className="mt-2 text-sm font-semibold text-slate-900">{permission}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant={status?.enabled ? 'outline' : 'primary'}
            disabled={busy}
            onClick={() => onToggle(!status?.enabled)}
          >
            {status?.enabled ? 'Desactivar' : 'Activar'}
          </Button>
          <Button size="sm" variant="ghost" disabled={testing || busy} onClick={sendTest}>
            {testing ? 'Enviando prueba...' : 'Enviar notificacion de prueba'}
          </Button>
        </div>

        <p className="text-xs text-slate-500">
          Aviso: en algunos dispositivos moviles el sonido depende de la configuracion del sistema y modo silencio.
        </p>
        {message && <p className="text-sm font-medium text-slate-700">{message}</p>}
      </div>
    </div>
  );
};

