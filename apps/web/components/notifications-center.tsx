'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Bell } from 'lucide-react';

type NotificationRow = {
  id: string;
  kind: 'SUCCESS' | 'ERROR' | 'INFO' | 'WARNING';
  title: string;
  body: string;
  link: string | null;
  readAt: string | null;
  createdAt: string;
};

type ToastRow = NotificationRow & { toastId: string };

const kindTone = {
  SUCCESS: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  ERROR: 'border-rose-200 bg-rose-50 text-rose-800',
  INFO: 'border-sky-200 bg-sky-50 text-sky-800',
  WARNING: 'border-amber-200 bg-amber-50 text-amber-800'
} as const;

export function NotificationsCenter() {
  const [csrf, setCsrf] = useState('');
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [toasts, setToasts] = useState<ToastRow[]>([]);
  const initialized = useRef(false);
  const seenIds = useRef<Set<string>>(new Set());

  const loadNotifications = async () => {
    const [csrfRes, notificationsRes] = await Promise.all([
      fetch('/api/security/csrf'),
      fetch('/api/notifications', { cache: 'no-store' })
    ]);

    if (csrfRes.ok) {
      const csrfData = await csrfRes.json();
      setCsrf(csrfData.token || '');
    }

    if (notificationsRes.status === 401) {
      setEnabled(false);
      return;
    }

    if (!notificationsRes.ok) return;

    const data = await notificationsRes.json();
    const nextNotifications = (data.notifications || []) as NotificationRow[];

    if (initialized.current) {
      const incoming = nextNotifications.filter(
        (notification) => !notification.readAt && !seenIds.current.has(notification.id)
      );
      if (incoming.length > 0) {
        const nextToasts = incoming.slice(0, 3).map((notification) => ({
          ...notification,
          toastId: `${notification.id}-${Date.now()}`
        }));
        setToasts((current) => [...nextToasts, ...current].slice(0, 4));
      }
    }

    seenIds.current = new Set(nextNotifications.map((notification) => notification.id));
    initialized.current = true;
    setNotifications(nextNotifications);
    setUnreadCount(data.unreadCount || 0);
  };

  useEffect(() => {
    loadNotifications().catch(() => undefined);
    const timer = window.setInterval(() => {
      loadNotifications().catch(() => undefined);
    }, 15000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (toasts.length === 0) return;
    const timers = toasts.map((toast) =>
      window.setTimeout(() => {
        setToasts((current) => current.filter((item) => item.toastId !== toast.toastId));
      }, 5000)
    );
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [toasts]);

  const unreadNotifications = useMemo(
    () => notifications.filter((notification) => !notification.readAt).length,
    [notifications]
  );

  const markRead = async (id: string) => {
    if (!csrf) return;
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrf },
      body: JSON.stringify({ id })
    });
    setNotifications((current) =>
      current.map((notification) =>
        notification.id === id ? { ...notification, readAt: new Date().toISOString() } : notification
      )
    );
    setUnreadCount((current) => Math.max(0, current - 1));
  };

  const markAllRead = async () => {
    if (!csrf) return;
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrf },
      body: JSON.stringify({ markAll: true })
    });
    setNotifications((current) =>
      current.map((notification) => ({ ...notification, readAt: notification.readAt || new Date().toISOString() }))
    );
    setUnreadCount(0);
  };

  if (!enabled) return null;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="relative inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-200/70 bg-white text-slate-700 transition hover:bg-slate-50"
        aria-label="Abrir notificaciones"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 ? (
          <span className="absolute -right-1 -top-1 rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 z-30 mt-3 w-[360px] max-w-[calc(100vw-2rem)] rounded-3xl border border-slate-200 bg-white p-4 shadow-2xl">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">Notificaciones</p>
              <p className="text-xs text-slate-500">{unreadNotifications} sin leer</p>
            </div>
            <button
              type="button"
              onClick={markAllRead}
              className="text-xs font-semibold text-slate-500 transition hover:text-slate-900"
            >
              Marcar todo
            </button>
          </div>

          <div className="mt-4 max-h-[420px] space-y-2 overflow-y-auto">
            {notifications.map((notification) => (
              <button
                key={notification.id}
                type="button"
                onClick={async () => {
                  if (!notification.readAt) {
                    await markRead(notification.id);
                  }
                  if (notification.link) {
                    window.location.href = notification.link;
                  }
                }}
                className={`w-full rounded-2xl border p-3 text-left transition ${
                  notification.readAt ? 'border-slate-200 bg-slate-50/70' : 'border-slate-300 bg-white'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${kindTone[notification.kind]}`}>
                    {notification.kind}
                  </span>
                  <span className="text-[11px] text-slate-400">
                    {new Date(notification.createdAt).toLocaleString('es-AR')}
                  </span>
                </div>
                <p className="mt-2 text-sm font-semibold text-slate-900">{notification.title}</p>
                <p className="mt-1 text-sm text-slate-600">{notification.body}</p>
              </button>
            ))}
            {notifications.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                Sin notificaciones.
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="pointer-events-none fixed right-4 top-20 z-40 flex w-[340px] max-w-[calc(100vw-2rem)] flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.toastId}
            className={`pointer-events-auto rounded-2xl border bg-white p-3 shadow-xl ${kindTone[toast.kind]}`}
          >
            <p className="text-sm font-semibold">{toast.title}</p>
            <p className="mt-1 text-sm">{toast.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
