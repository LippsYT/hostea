'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { calcBreakdown } from '@/lib/intelligent-pricing';

export const ClientOfferActions = ({
  threadId,
  offerTotal,
  listingTitle,
  checkIn,
  checkOut,
  guestsCount
}: {
  threadId: string;
  offerTotal: number;
  listingTitle?: string;
  checkIn?: string;
  checkOut?: string;
  guestsCount?: number;
}) => {
  const [loading, setLoading] = useState(false);
  const breakdown = calcBreakdown(offerTotal);

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
      {listingTitle ? <p className="mt-1 text-sm font-semibold text-indigo-950">{listingTitle}</p> : null}
      {checkIn && checkOut ? (
        <p className="text-xs text-indigo-900">
          Estadia: {checkIn} - {checkOut}
          {guestsCount ? ` · ${guestsCount} huesped${guestsCount > 1 ? 'es' : ''}` : ''}
        </p>
      ) : null}
      <div className="mt-3 rounded-xl border border-indigo-200 bg-white p-3 text-sm text-slate-700">
        <div className="flex items-center justify-between">
          <span>Cargos administrativos</span>
          <span>USD {breakdown.stripeFee.toFixed(2)}</span>
        </div>
        <div className="mt-1 flex items-center justify-between">
          <span>Tarifa de servicio</span>
          <span>USD {breakdown.platformFee.toFixed(2)}</span>
        </div>
        <div className="mt-2 flex items-center justify-between border-t border-indigo-100 pt-2 font-semibold text-indigo-950">
          <span>Precio final</span>
          <span>USD {offerTotal.toFixed(2)}</span>
        </div>
      </div>
      <Button className="mt-3 w-full" onClick={acceptOffer} disabled={loading}>
        {loading ? 'Procesando...' : 'Aceptar oferta y pagar'}
      </Button>
    </div>
  );
};
