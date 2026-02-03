'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

export default function CancelPage() {
  const params = useSearchParams();
  const [message, setMessage] = useState('El pago no se completo. Podes intentar nuevamente.');

  useEffect(() => {
    const reservationId = params.get('reservationId');
    if (!reservationId) return;

    const cancelReservation = async () => {
      try {
        const csrf = await fetch('/api/security/csrf').then((res) => res.json());
        await fetch(`/api/reservations/${reservationId}/cancel`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-csrf-token': csrf.token
          }
        });
      } catch {
        setMessage('El pago no se completo. Podes intentar nuevamente.');
      }
    };

    cancelReservation();
  }, [params]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50">
      <div className="rounded-3xl bg-white p-8 shadow-soft">
        <h1 className="text-2xl font-semibold">Pago cancelado</h1>
        <p className="mt-2 text-sm text-neutral-500">{message}</p>
      </div>
    </div>
  );
}
