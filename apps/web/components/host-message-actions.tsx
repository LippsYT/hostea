'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ReservationStatus } from '@prisma/client';

export const HostMessageActions = ({
  threadId,
  reservationStatus,
  guestPhone
}: {
  threadId?: string;
  reservationStatus?: ReservationStatus | string | null;
  guestPhone?: string | null;
}) => {
  const [csrf, setCsrf] = useState('');
  const [offerTotal, setOfferTotal] = useState('');
  const [offerExpiresAt, setOfferExpiresAt] = useState('');

  useEffect(() => {
    fetch('/api/security/csrf').then(async (res) => {
      const data = await res.json();
      setCsrf(data.token);
    });
  }, []);

  if (!threadId) {
    return <p className="text-sm text-slate-500">Selecciona una conversacion.</p>;
  }

  const sendAction = async (action: string) => {
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
  };

  if (reservationStatus === ReservationStatus.CONFIRMED) {
    return (
      <div className="mt-3 space-y-2">
        <Button className="w-full" variant="outline" onClick={() => alert('Funcionalidad en camino: enviar/solicitar dinero.')}>
          Enviar o solicitar dinero
        </Button>
        {guestPhone ? (
          <a className="block" href={`tel:${guestPhone}`}>
            <Button className="w-full" variant="outline">Llamar</Button>
          </a>
        ) : (
          <p className="text-xs text-slate-400">Teléfono no disponible</p>
        )}
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-2">
      <Button variant="outline" className="w-full" onClick={() => sendAction('preapprove')}>
        Preaprobar
      </Button>
      <div className="space-y-2 rounded-2xl border border-slate-200/70 p-3">
        <input
          value={offerTotal}
          onChange={(e) => setOfferTotal(e.target.value)}
          type="number"
          step="0.01"
          placeholder="Oferta USD"
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
        />
        <input
          value={offerExpiresAt}
          onChange={(e) => setOfferExpiresAt(e.target.value)}
          type="date"
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
        />
        <Button className="w-full" onClick={() => sendAction('offer')}>
          Oferta especial
        </Button>
      </div>
      <Button variant="outline" className="w-full border-red-200 text-red-600 hover:bg-red-50" onClick={() => sendAction('reject')}>
        Rechazar
      </Button>
    </div>
  );
};
