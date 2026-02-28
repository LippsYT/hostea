'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { reservationStatusBadgeClass, reservationStatusLabel } from '@/lib/reservation-status';
import { ReservationStatus } from '@prisma/client';

export const ClientReservations = ({ reservations }: { reservations: any[] }) => {
  const [csrf, setCsrf] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/security/csrf').then(async (res) => {
      const data = await res.json();
      setCsrf(data.token);
    });
  }, []);

  const createThread = async (reservationId: string) => {
    setError('');
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
    setError(data.error || 'No se pudo crear el hilo.');
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
      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </div>
      ) : null}
      {reservations.map((res) => (
        <div key={res.id} className="surface-card">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="h-16 w-24 overflow-hidden rounded-2xl bg-slate-100">
                {res.listing.photoUrl ? (
                  <img src={res.listing.photoUrl} alt={res.listing.title} className="h-full w-full object-cover" />
                ) : null}
              </div>
              <div>
                <p className="text-lg font-semibold text-slate-900">{res.listing.title}</p>
                <p className="text-sm text-slate-500">{res.checkIn} · {res.checkOut} · {res.guestsCount} huéspedes</p>
                {res.reservationNumber ? (
                  <p className="text-xs text-slate-500">Nro reserva: {res.reservationNumber}</p>
                ) : null}
                <div className="mt-2">
                  <Badge className={reservationStatusBadgeClass(res.status)}>
                    {reservationStatusLabel(res.status)}
                  </Badge>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
              <p className="mr-4 font-semibold text-slate-900">USD {Number(res.total).toFixed(2)}</p>
              {(res.status === ReservationStatus.PENDING_PAYMENT ||
                res.status === ReservationStatus.AWAITING_PAYMENT) && (
                <Button onClick={() => setError('Pago pendiente: abre el chat y usa "Pagar y confirmar".')}>
                  Pagar
                </Button>
              )}
              {res.status === ReservationStatus.CONFIRMED && (
                <Button variant="outline" onClick={() => createThread(res.id)}>
                  Mensaje
                </Button>
              )}
              <Button variant="outline" onClick={() => (window.location.href = `/listings/${res.listing.id}`)}>
                Ver detalle
              </Button>
              {res.status === ReservationStatus.CONFIRMED && (
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
