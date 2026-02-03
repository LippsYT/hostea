'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const schema = z.object({
  checkIn: z.string().min(1),
  checkOut: z.string().min(1)
});

type FormValues = z.infer<typeof schema>;

type GuestCounts = {
  adults: number;
  children: number;
  infants: number;
  pets: number;
};

export const BookingForm = ({ listingId }: { listingId: string }) => {
  const [csrfToken, setCsrfToken] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [guestOpen, setGuestOpen] = useState(false);
  const [guestError, setGuestError] = useState('');
  const [guests, setGuests] = useState<GuestCounts>({
    adults: 1,
    children: 0,
    infants: 0,
    pets: 0
  });
  const { register, handleSubmit } = useForm<FormValues>({ resolver: zodResolver(schema) });

  useEffect(() => {
    fetch('/api/security/csrf').then(async (res) => {
      const data = await res.json();
      setCsrfToken(data.token);
    });
  }, []);

  const updateGuest = (key: keyof GuestCounts, delta: number) => {
    setGuests((prev) => {
      const next = { ...prev, [key]: Math.max(0, prev[key] + delta) };
      if (key === 'adults' && next.adults < 1) {
        next.adults = 1;
      }
      return next;
    });
  };

  const totalGuests = guests.adults + guests.children + guests.infants;
  const guestSummary = `${totalGuests} huesped${totalGuests === 1 ? '' : 'es'}` + (guests.pets ? `, ${guests.pets} mascota${guests.pets === 1 ? '' : 's'}` : '');

  const onSubmit = async (values: FormValues) => {
    if (guests.adults < 1) {
      setGuestError('Debe haber al menos 1 adulto');
      return;
    }
    setGuestError('');
    setLoading(true);
    const res = await fetch('/api/reservations/checkout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': csrfToken
      },
      body: JSON.stringify({
        listingId,
        ...values,
        guests: totalGuests,
        guestsBreakdown: guests
      })
    });
    const data = await res.json();
    if (data.checkoutUrl) {
      window.location.href = data.checkoutUrl;
    } else {
      alert(data.error || 'No se pudo iniciar el pago');
    }
    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <Input type="date" {...register('checkIn')} />
      <Input type="date" {...register('checkOut')} />

      <div className="relative">
        <button
          type="button"
          className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left text-sm"
          onClick={() => setGuestOpen((prev) => !prev)}
        >
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Viajeros</p>
            <p className="text-sm text-slate-800">{guestSummary}</p>
          </div>
          <span className="text-xs text-slate-400">{guestOpen ? 'Cerrar' : 'Editar'}</span>
        </button>

        {guestOpen && (
          <div className="absolute z-20 mt-2 w-full rounded-2xl border border-slate-200 bg-white p-4 shadow-xl">
            {[
              { label: 'Adultos', sub: '13+ años', key: 'adults' },
              { label: 'Niños', sub: '2-12 años', key: 'children' },
              { label: 'Bebés', sub: 'Menos de 2', key: 'infants' },
              { label: 'Mascotas', sub: 'Servicio', key: 'pets' }
            ].map((item) => (
              <div key={item.key} className="flex items-center justify-between py-2">
                <div>
                  <p className="text-sm font-medium text-slate-900">{item.label}</p>
                  <p className="text-xs text-slate-500">{item.sub}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="h-8 w-8 rounded-full border border-slate-300 text-slate-600"
                    onClick={() => updateGuest(item.key as keyof GuestCounts, -1)}
                  >
                    -
                  </button>
                  <span className="w-6 text-center text-sm">{guests[item.key as keyof GuestCounts]}</span>
                  <button
                    type="button"
                    className="h-8 w-8 rounded-full border border-slate-300 text-slate-600"
                    onClick={() => updateGuest(item.key as keyof GuestCounts, 1)}
                  >
                    +
                  </button>
                </div>
              </div>
            ))}
            <div className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-500">
              Capacidad maxima definida por el alojamiento.
            </div>
          </div>
        )}
      </div>

      {guestError && <p className="text-xs text-red-600">{guestError}</p>}

      <Button type="submit" size="lg" disabled={loading}>
        {loading ? 'Procesando...' : 'Reservar ahora'}
      </Button>
    </form>
  );
};
