'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ReservationStatus } from '@prisma/client';

type HostMessageActionsProps = {
  threadId?: string;
  reservationStatus?: ReservationStatus | string | null;
  guestPhone?: string | null;
};

export const HostMessageActions = ({
  threadId,
  reservationStatus,
  guestPhone
}: HostMessageActionsProps) => {
  const [csrf, setCsrf] = useState('');
  const [offerTotal, setOfferTotal] = useState('');
  const [offerExpiresAt, setOfferExpiresAt] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    fetch('/api/security/csrf').then(async (res) => {
      const data = await res.json();
      setCsrf(data.token);
    });
  }, []);

  if (!threadId) {
    return <p className="text-sm text-slate-500">Selecciona una conversacion.</p>;
  }

  const isClosed =
    reservationStatus === ReservationStatus.CANCELED ||
    reservationStatus === ReservationStatus.REFUNDED;

  const sendAction = async (action: 'preapprove' | 'offer' | 'close') => {
    setSending(true);
    try {
      const res = await fetch(`/api/host/messages/${threadId}/actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrf },
        body: JSON.stringify({ action, offerTotal, offerExpiresAt })
      });
      const data = await res.json();
      if (data.error) {
        alert(data.error);
        return;
      }
      if (action === 'offer') {
        setOfferTotal('');
        setOfferExpiresAt('');
      }
      window.location.reload();
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-3">
      <Button variant="outline" className="w-full" disabled={sending || isClosed} onClick={() => sendAction('preapprove')}>
        Invitar a reservar
      </Button>

      <div className="space-y-2 rounded-2xl border border-slate-200/70 bg-slate-50/70 p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Oferta especial</p>
        <input
          value={offerTotal}
          onChange={(e) => setOfferTotal(e.target.value)}
          type="number"
          step="0.01"
          placeholder="Precio personalizado (USD)"
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
        />
        <input
          value={offerExpiresAt}
          onChange={(e) => setOfferExpiresAt(e.target.value)}
          type="date"
          className="date-input w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
        />
        <Button className="w-full" disabled={sending || !offerTotal} onClick={() => sendAction('offer')}>
          Enviar oferta especial
        </Button>
      </div>

      <Button
        variant="outline"
        className="w-full border-red-200 text-red-600 hover:bg-red-50"
        disabled={sending}
        onClick={() => sendAction('close')}
      >
        Cerrar conversacion
      </Button>

      {guestPhone ? (
        <a className="block" href={`tel:${guestPhone}`}>
          <Button className="w-full" variant="outline" disabled={sending}>
            Llamar al huesped
          </Button>
        </a>
      ) : (
        <p className="text-xs text-slate-400">Telefono no disponible</p>
      )}
    </div>
  );
};
