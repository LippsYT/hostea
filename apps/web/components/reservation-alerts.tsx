'use client';

import { useEffect } from 'react';
import {
  emitInAppNotificationSound,
  inAppSoundEventName,
  markInAppSoundUnlocked,
  playInAppNotificationSound
} from '@/lib/in-app-notification-sound';

type Reservation = {
  id: string;
  status: string;
  createdAt: string;
};

type ReservationAlertsProps = {
  roles: string[];
};

const notifyReservation = (count: number) => {
  if (typeof window === 'undefined') return;

  if ('Notification' in window) {
    if (Notification.permission === 'default') {
      Notification.requestPermission().catch(() => undefined);
    } else if (Notification.permission === 'granted') {
      new Notification('Nueva reserva confirmada', {
        body: count === 1 ? 'Tienes una nueva reserva.' : `Tienes ${count} nuevas reservas.`,
        silent: true
      });
    }
  }

  emitInAppNotificationSound('reservation');
};

export const ReservationAlerts = ({ roles }: ReservationAlertsProps) => {
  useEffect(() => {
    const onUserInteraction = () => {
      markInAppSoundUnlocked();
    };

    const onInAppAlert = () => {
      playInAppNotificationSound().catch(() => undefined);
    };

    window.addEventListener('pointerdown', onUserInteraction, { passive: true });
    window.addEventListener('keydown', onUserInteraction);
    window.addEventListener('touchstart', onUserInteraction, { passive: true });
    window.addEventListener(inAppSoundEventName, onInAppAlert as EventListener);

    return () => {
      window.removeEventListener('pointerdown', onUserInteraction);
      window.removeEventListener('keydown', onUserInteraction);
      window.removeEventListener('touchstart', onUserInteraction);
      window.removeEventListener(inAppSoundEventName, onInAppAlert as EventListener);
    };
  }, []);

  useEffect(() => {
    if (!roles?.length) return;
    const isAdmin = roles.includes('ADMIN');
    const isHost = roles.includes('HOST');
    if (!isAdmin && !isHost) return;

    const endpoint = isAdmin ? '/api/admin/reservations' : '/api/host/reservations';
    const storageKey = isAdmin ? 'hostea_last_admin_res' : 'hostea_last_host_res';

    const poll = async () => {
      try {
        const res = await fetch(endpoint);
        if (!res.ok) return;
        const data = await res.json();
        const reservations: Reservation[] = data?.reservations || [];
        const lastSeen = Number(localStorage.getItem(storageKey) || 0);

        const latest = reservations.reduce((max, reservation) => {
          const ts = new Date(reservation.createdAt).getTime();
          return ts > max ? ts : max;
        }, 0);

        const newConfirmed = reservations.filter((reservation) => {
          const ts = new Date(reservation.createdAt).getTime();
          return ts > lastSeen && reservation.status === 'CONFIRMED';
        });

        if (newConfirmed.length > 0) {
          notifyReservation(newConfirmed.length);
        }

        if (latest > 0) {
          localStorage.setItem(storageKey, String(latest));
        }
      } catch {
        // ignore polling errors
      }
    };

    poll();
    const timer = setInterval(poll, 30000);
    return () => clearInterval(timer);
  }, [roles]);

  return null;
};
