'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ReservationStatus } from '@prisma/client';
import {
  calcBreakdown,
  calcClientPriceFromHostNet,
  defaultSmartPricingParams,
  withSmartPricingParams
} from '@/lib/intelligent-pricing';

type HostMessageActionsProps = {
  threadId?: string;
  reservationStatus?: ReservationStatus | string | null;
  guestPhone?: string | null;
  defaultCheckIn?: string | null;
  defaultCheckOut?: string | null;
  defaultGuestsCount?: number | null;
};

export const HostMessageActions = ({
  threadId,
  reservationStatus,
  guestPhone,
  defaultCheckIn,
  defaultCheckOut,
  defaultGuestsCount
}: HostMessageActionsProps) => {
  const [csrf, setCsrf] = useState('');
  const [offerHostNet, setOfferHostNet] = useState('');
  const [offerCheckIn, setOfferCheckIn] = useState(defaultCheckIn || '');
  const [offerCheckOut, setOfferCheckOut] = useState(defaultCheckOut || '');
  const [offerGuestsCount, setOfferGuestsCount] = useState(
    String(Math.max(1, Number(defaultGuestsCount) || 1))
  );
  const [pricingParams, setPricingParams] = useState(defaultSmartPricingParams);
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: 'error' | 'ok'; message: string } | null>(null);

  useEffect(() => {
    fetch('/api/security/csrf').then(async (res) => {
      const data = await res.json();
      setCsrf(data.token);
    });
    fetch('/api/settings')
      .then((res) => res.json())
      .then((data) => {
        const hostCommissionPct = Number(
          data?.settings?.hostCommissionPercent ?? data?.settings?.commissionPercent
        );
        const guestServicePct = Number(data?.settings?.guestServicePercent);
        const processingPct = Number(data?.settings?.processingPercent);
        const processingFixed = Number(data?.settings?.processingFixed);
        setPricingParams((current) =>
          withSmartPricingParams({
            stripePct: Number.isFinite(processingPct) ? processingPct : current.stripePct,
            stripeFixed: Number.isFinite(processingFixed) ? processingFixed : current.stripeFixed,
            platformPct: Number.isFinite(hostCommissionPct)
              ? hostCommissionPct
              : current.platformPct,
            guestPct: Number.isFinite(guestServicePct) ? guestServicePct : current.guestPct
          })
        );
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    setOfferCheckIn(defaultCheckIn || '');
    setOfferCheckOut(defaultCheckOut || '');
    setOfferGuestsCount(String(Math.max(1, Number(defaultGuestsCount) || 1)));
  }, [threadId, defaultCheckIn, defaultCheckOut, defaultGuestsCount]);

  if (!threadId) {
    return <p className="text-sm text-slate-500">Selecciona una conversacion.</p>;
  }

  const isClosed =
    reservationStatus === ReservationStatus.CANCELED ||
    reservationStatus === ReservationStatus.REJECTED ||
    reservationStatus === ReservationStatus.EXPIRED ||
    reservationStatus === ReservationStatus.REFUNDED ||
    reservationStatus === 'REJECTED' ||
    reservationStatus === 'EXPIRED';
  const isPendingApproval = reservationStatus === 'PENDING_APPROVAL';
  const isAwaitingPayment = reservationStatus === 'AWAITING_PAYMENT';
  const desiredNet = Math.max(0, Number(offerHostNet) || 0);
  const offerClientPrice = calcClientPriceFromHostNet(desiredNet, pricingParams);
  const offerBreakdown = calcBreakdown(offerClientPrice, pricingParams);

  const sendAction = async (
    action: 'preapprove' | 'offer' | 'close' | 'approve_request' | 'reject_request'
  ) => {
    setSending(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/host/messages/${threadId}/actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrf },
        body: JSON.stringify({
          action,
          offerTotal: action === 'offer' ? offerClientPrice : undefined,
          offerHostNet: action === 'offer' ? desiredNet : undefined,
          checkIn: action === 'offer' ? offerCheckIn : undefined,
          checkOut: action === 'offer' ? offerCheckOut : undefined,
          guestsCount: action === 'offer' ? Number(offerGuestsCount) : undefined
        })
      });
      const data = await res.json();
      if (data.error) {
        setFeedback({ tone: 'error', message: data.error });
        return;
      }
      if (action === 'offer') {
        setOfferHostNet('');
      }
      setFeedback({ tone: 'ok', message: 'Accion enviada correctamente.' });
      window.location.reload();
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-3">
      {feedback ? (
        <div
          className={`rounded-xl border px-3 py-2 text-xs ${
            feedback.tone === 'error'
              ? 'border-rose-200 bg-rose-50 text-rose-700'
              : 'border-emerald-200 bg-emerald-50 text-emerald-700'
          }`}
        >
          {feedback.message}
        </div>
      ) : null}
      {isPendingApproval && (
        <div className="space-y-2 rounded-2xl border border-sky-200 bg-sky-50 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">
            Solicitud pendiente
          </p>
          <Button className="w-full" disabled={sending} onClick={() => sendAction('approve_request')}>
            Aprobar solicitud
          </Button>
          <Button
            variant="outline"
            className="w-full border-rose-200 text-rose-600 hover:bg-rose-50"
            disabled={sending}
            onClick={() => sendAction('reject_request')}
          >
            Rechazar
          </Button>
        </div>
      )}

      {!isPendingApproval && (
        <Button
          variant="outline"
          className="w-full"
          disabled={sending || isClosed || isAwaitingPayment}
          onClick={() => sendAction('preapprove')}
        >
          Invitar a reservar
        </Button>
      )}

      {isAwaitingPayment && (
        <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-3 text-sm text-indigo-900">
          La solicitud ya fue aprobada. Estamos esperando que el cliente pague para confirmar.
        </div>
      )}

      <div className="space-y-2 rounded-2xl border border-slate-200/70 bg-slate-50/70 p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Oferta especial</p>
        <input
          value={offerHostNet}
          onChange={(e) => setOfferHostNet(e.target.value)}
          type="number"
          step="0.01"
          placeholder="Neto a recibir (USD)"
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
        />
        <div className="grid gap-2 sm:grid-cols-2">
          <input
            value={offerCheckIn}
            onChange={(e) => setOfferCheckIn(e.target.value)}
            type="date"
            className="date-input w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
          />
          <input
            value={offerCheckOut}
            onChange={(e) => setOfferCheckOut(e.target.value)}
            type="date"
            className="date-input w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
          />
        </div>
        <input
          value={offerGuestsCount}
          onChange={(e) => setOfferGuestsCount(e.target.value)}
          type="number"
          min={1}
          placeholder="Huespedes"
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
        />
        <div className="rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-600">
          <p className="font-semibold text-slate-900">Resumen de oferta</p>
          <div className="mt-2 space-y-1">
            <div className="flex items-center justify-between">
              <span>Neto anfitrion</span>
              <span>USD {offerBreakdown.hostNet.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Cargos administrativos</span>
              <span>USD {offerBreakdown.stripeFee.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Tarifa de servicio Hostea (huesped)</span>
              <span>USD {offerBreakdown.guestFee.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Comision Hostea (anfitrion)</span>
              <span>USD {offerBreakdown.platformFee.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between font-semibold text-slate-900">
              <span>Precio final al cliente</span>
              <span>USD {offerClientPrice.toFixed(2)}</span>
            </div>
          </div>
          <p className="mt-2 text-xs text-slate-500">La oferta vence automaticamente en 48 horas.</p>
        </div>
        <Button
          className="w-full"
          disabled={sending || !desiredNet || !offerCheckIn || !offerCheckOut}
          onClick={() => sendAction('offer')}
        >
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
