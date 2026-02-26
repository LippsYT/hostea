'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';

export const ClientOfferActions = ({
  threadId,
  offerTotal
}: {
  threadId: string;
  offerTotal: number;
}) => {
  const [loading, setLoading] = useState(false);

  const acceptOffer = async () => {
    try {
      setLoading(true);
      const csrfRes = await fetch('/api/security/csrf');
      const csrfData = await csrfRes.json().catch(() => ({}));
      const token = csrfData?.token || '';

      const res = await fetch(`/api/messages/${threadId}/offer/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': token }
      });
      const data = await res.json().catch(() => ({}));
      if (data?.checkoutUrl) {
        window.location.href = data.checkoutUrl;
        return;
      }
      alert(data?.error || 'No se pudo aceptar la oferta');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-3 rounded-2xl border border-indigo-200 bg-indigo-50 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">Oferta especial</p>
      <p className="mt-1 text-sm text-indigo-900">Total propuesto: USD {offerTotal.toFixed(2)}</p>
      <Button className="mt-3 w-full" onClick={acceptOffer} disabled={loading}>
        {loading ? 'Procesando...' : 'Aceptar oferta y pagar'}
      </Button>
    </div>
  );
};
