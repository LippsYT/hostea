'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';

export const HostMessageActions = ({ threadId }: { threadId?: string }) => {
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
