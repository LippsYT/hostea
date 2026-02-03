'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';

export const ClientReservations = ({ reservations }: { reservations: any[] }) => {
  const [csrf, setCsrf] = useState('');

  useEffect(() => {
    fetch('/api/security/csrf').then(async (res) => {
      const data = await res.json();
      setCsrf(data.token);
    });
  }, []);

  const createThread = async (reservationId: string) => {
    const res = await fetch('/api/messages/threads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrf },
      body: JSON.stringify({ reservationId })
    });
    const data = await res.json().catch(() => ({}));
    if (data.thread?.id) {
      window.location.href = `/dashboard/client/messages?threadId=${data.thread.id}`;
      return;
    }
    alert(data.error || 'No se pudo crear el hilo');
  };

  const cancel = async (id: string) => {
    await fetch(`/api/reservations/${id}/cancel`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': csrf
      }
    });
    window.location.reload();
  };

  return (
    <div className="mt-6 space-y-4">
      {reservations.map((res) => (
        <div key={res.id} className="surface-card">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-lg font-semibold text-slate-900">{res.listing.title}</p>
              <p className="text-sm text-slate-500">{res.status}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => createThread(res.id)}>
                Mensaje
              </Button>
              {res.status === 'CONFIRMED' && (
                <Button variant="outline" onClick={() => cancel(res.id)}>
                  Cancelar
                </Button>
              )}
            </div>
          </div>
        </div>
      ))}
      {reservations.length === 0 && <div className="text-sm text-slate-500">No tienes reservas todavia.</div>}
    </div>
  );
};
