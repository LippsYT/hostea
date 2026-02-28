'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';

export const ClientReservationPaymentActions = ({
  reservationId,
  paymentExpiresAt
}: {
  reservationId: string;
  paymentExpiresAt?: string | null;
}) => {
  const [loading, setLoading] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [error, setError] = useState('');

  const payReservation = async () => {
    try {
      setLoading(true);
      setError('');
      const csrfRes = await fetch('/api/security/csrf');
      const csrfData = await csrfRes.json().catch(() => ({}));
      const token = csrfData?.token || '';

      const res = await fetch(`/api/reservations/${reservationId}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': token }
      });

      const data = await res.json().catch(() => ({}));
      if (data?.checkoutUrl) {
        window.location.href = data.checkoutUrl;
        return;
      }
      setError(data?.error || 'No se pudo iniciar el pago');
    } finally {
      setLoading(false);
    }
  };

  const rejectReservation = async () => {
    try {
      setRejecting(true);
      setError('');
      const csrfRes = await fetch('/api/security/csrf');
      const csrfData = await csrfRes.json().catch(() => ({}));
      const token = csrfData?.token || '';

      const res = await fetch(`/api/reservations/${reservationId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': token }
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || 'No se pudo rechazar la solicitud');
        return;
      }
      window.location.reload();
    } finally {
      setRejecting(false);
    }
  };

  return (
    <div className="mt-3 rounded-2xl border border-indigo-200 bg-indigo-50 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">Pago pendiente</p>
      <p className="mt-1 text-sm text-indigo-900">
        Tu solicitud fue aprobada. Completa el pago para confirmar la reserva.
      </p>
      {paymentExpiresAt ? (
        <p className="mt-1 text-xs text-indigo-700">
          Vence: {new Date(paymentExpiresAt).toLocaleString('es-AR')}
        </p>
      ) : null}
      <Button className="mt-3 w-full" onClick={payReservation} disabled={loading}>
        {loading ? 'Redirigiendo...' : 'Pagar y confirmar'}
      </Button>
      <Button
        className="mt-2 w-full"
        variant="outline"
        onClick={rejectReservation}
        disabled={rejecting}
      >
        {rejecting ? 'Procesando...' : 'Rechazar'}
      </Button>
      {error ? <p className="mt-2 text-xs text-rose-700">{error}</p> : null}
    </div>
  );
};
