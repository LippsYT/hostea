'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';

export type HostReservation = {
  id: string;
  listingTitle: string;
  guestEmail: string;
  status: string;
  checkIn: string;
  checkOut: string;
};

export const HostReservations = ({ reservations }: { reservations: HostReservation[] }) => {
  const [csrf, setCsrf] = useState('');

  useEffect(() => {
    fetch('/api/security/csrf').then(async (res) => {
      const data = await res.json();
      setCsrf(data.token);
    });
  }, []);

  const updateStatus = async (id: string, status: string) => {
    await fetch(`/api/host/reservations/${id}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrf },
      body: JSON.stringify({ status })
    });
    window.location.reload();
  };

  return (
    <div className="space-y-3">
      {reservations.map((r) => (
        <div key={r.id} className="surface-card">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-lg font-semibold text-slate-900">{r.listingTitle}</p>
              <p className="text-sm text-slate-500">{r.guestEmail}</p>
              <p className="text-sm text-slate-500">{r.checkIn} - {r.checkOut}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                {r.status}
              </span>
              <Button size="sm" variant="outline" onClick={() => updateStatus(r.id, 'CHECKED_IN')}>Check-in</Button>
              <Button size="sm" variant="outline" onClick={() => updateStatus(r.id, 'COMPLETED')}>Completar</Button>
            </div>
          </div>
        </div>
      ))}
      {reservations.length === 0 && <p className="text-sm text-slate-500">No hay reservas.</p>}
    </div>
  );
};
