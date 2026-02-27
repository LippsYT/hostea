'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { isInAppSoundEnabled, setInAppSoundEnabled } from '@/lib/in-app-notification-sound';

type PushRole = 'host' | 'client';

type PushStatus = {
  role: PushRole;
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

const isIosDevice = () => /iphone|ipad|ipod/i.test(window.navigator.userAgent);

const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  (window.navigator as any).standalone === true;

export const PushSubscribeCard = ({
  role,
  title,
  subtitle
}: {
  role: PushRole;
  title: string;
  subtitle: string;
}) => {
  const [csrf, setCsrf] = useState('');
  const [status, setStatus] = useState<PushStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [showIosHint, setShowIosHint] = useState(false);
  const [permissionState, setPermissionState] = useState<string>('default');
  const [isIos, setIsIos] = useState(false);
  const [standalone, setStandalone] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);

  const permissionLabel = useMemo(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return 'No disponible';
    if (permissionState === 'granted') return 'Permitido';
    if (permissionState === 'denied') return 'Bloqueado';
    return 'Pendiente';
  }, [permissionState]);

  const loadStatus = async () => {
    const [csrfRes, statusRes] = await Promise.all([
      fetch('/api/security/csrf'),
      fetch(`/api/push/subscriptions?role=${role}`)
    ]);
    const csrfData = await csrfRes.json();
    setCsrf(csrfData.token || '');
    if (statusRes.ok) {
      const data = (await statusRes.json()) as PushStatus;
      setStatus(data);
    } else {
      setStatus(null);
    }
  };

  useEffect(() => {
    loadStatus().catch(() => undefined);
    if (typeof window !== 'undefined') {
      setIsIos(isIosDevice());
      setStandalone(isStandalone());
      setSoundEnabled(isInAppSoundEnabled());
      if ('Notification' in window) {
        setPermissionState(Notification.permission);
      }
    }
  }, [role]);

  const toggleInAppSound = () => {
    setSoundEnabled((prev) => {
      const next = !prev;
      setInAppSoundEnabled(next);
      return next;
    });
  };

  const requestAndSaveSubscription = async () => {
    if (!status?.vapidPublicKey) {
      setMessage('Falta configurar VAPID_PUBLIC_KEY.');
      return;
    }
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      setMessage('Tu navegador no soporta notificaciones push.');
      return;
    }

    if (isIos && !standalone) {
      setShowIosHint(true);
      return;
    }

    const permission = await Notification.requestPermission();
    setPermissionState(permission);
    if (permission !== 'granted') {
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

    const payload = subscription.toJSON();
    const res = await fetch('/api/push/subscriptions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': csrf
      },
      body: JSON.stringify({
        role,
        endpoint: subscription.endpoint,
        keys: payload.keys,
        userAgent: navigator.userAgent
      })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data?.error || 'No se pudo guardar la suscripcion');
    }
  };

  const activate = async () => {
    setBusy(true);
    setMessage('');
    try {
      await requestAndSaveSubscription();
      await loadStatus();
      setMessage('Notificaciones activadas.');
    } catch (error: any) {
      setMessage(error?.message || 'No se pudieron activar las notificaciones');
    } finally {
      setBusy(false);
    }
  };

  const deactivate = async () => {
    setBusy(true);
    setMessage('');
    try {
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) {
          await fetch('/api/push/subscriptions', {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
              'x-csrf-token': csrf
            },
            body: JSON.stringify({
              role,
              endpoint: subscription.endpoint,
              disable: true
            })
          });
          await subscription.unsubscribe();
        } else {
          await fetch('/api/push/subscriptions', {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              'x-csrf-token': csrf
            },
            body: JSON.stringify({
              role,
              enabled: false
            })
          });
        }
      }

      await loadStatus();
      setMessage('Notificaciones desactivadas.');
    } catch (error: any) {
      setMessage(error?.message || 'No se pudieron desactivar las notificaciones');
    } finally {
      setBusy(false);
    }
  };

  const sendTest = async () => {
    setBusy(true);
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
        throw new Error(data?.error || 'No se pudo enviar la prueba');
      }
      setMessage('Notificacion de prueba enviada.');
    } catch (error: any) {
      setMessage(error?.message || 'No se pudo enviar la prueba');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="surface-card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">{title}</h2>
            <p className="text-sm text-slate-500">{subtitle}</p>
          </div>
          {status?.enabled ? (
            <Button size="sm" variant="outline" disabled={busy} onClick={deactivate}>
              {busy ? 'Desactivando...' : 'Desactivar notificaciones'}
            </Button>
          ) : (
            <Button size="sm" disabled={busy} onClick={activate}>
              {busy ? 'Activando...' : 'Activar notificaciones'}
            </Button>
          )}
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Estado</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">
              {status?.enabled ? 'Activas' : 'Desactivadas'}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Dispositivos</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{status?.activeDevices || 0}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Permiso</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{permissionLabel}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Sonido dentro de la app</p>
            <button
              type="button"
              className="mt-2 inline-flex items-center gap-2 text-sm font-semibold text-slate-900"
              onClick={toggleInAppSound}
            >
              <span
                className={`inline-block h-5 w-9 rounded-full transition-colors ${
                  soundEnabled ? 'bg-slate-900' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`mt-0.5 block h-4 w-4 rounded-full bg-white transition-transform ${
                    soundEnabled ? 'translate-x-4' : 'translate-x-0.5'
                  }`}
                />
              </span>
              {soundEnabled ? 'Activado' : 'Desactivado'}
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button size="sm" variant="ghost" disabled={busy} onClick={sendTest}>
            Enviar notificacion de prueba
          </Button>
          <a href="/debug/push" className="pill-link">
            Ir a debug push
          </a>
        </div>

        {isIos && !standalone && (
          <p className="mt-3 text-xs text-slate-500">
            iPhone: para recibir push debes abrir Hostea desde "Agregar a pantalla de inicio".
          </p>
        )}

        {isIos && (
          <p className="mt-2 text-xs text-slate-500">
            El sonido depende del modo Silencio/Focus y ajustes de iPhone. Activa sonidos en Ajustes &gt;
            Notificaciones &gt; Hostea.
          </p>
        )}

        {message && <p className="mt-3 text-sm font-medium text-slate-700">{message}</p>}
      </div>

      {showIosHint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900">Activacion en iPhone</h3>
            <p className="mt-2 text-sm text-slate-600">
              Para recibir notificaciones en iPhone: Safari - Compartir - Agregar a pantalla de inicio.
              Abre Hostea desde el icono y vuelve a activar.
            </p>
            <div className="mt-4 flex justify-end">
              <Button size="sm" onClick={() => setShowIosHint(false)}>
                Entendido
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
