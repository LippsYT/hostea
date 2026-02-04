'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { reservationStatusBadgeClass, reservationStatusLabel } from '@/lib/reservation-status';

export type HostReservation = {
  id: string;
  listingTitle: string;
  guestName: string;
  guestPhone?: string | null;
  status: string;
  checkIn: string;
  checkOut: string;
  total?: number;
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
              <p className="text-lg font-semibold text-slate-900">{r.guestName}</p>
              <p className="text-sm text-slate-500">Reserva · {r.listingTitle}</p>
              <p className="text-sm text-slate-500">{r.checkIn} - {r.checkOut}</p>
              {r.total !== undefined && (
                <p className="text-sm text-slate-600">Total USD {Number(r.total).toFixed(2)}</p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge className={reservationStatusBadgeClass(r.status)}>
                {reservationStatusLabel(r.status)}
              </Badge>
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
