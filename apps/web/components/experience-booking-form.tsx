'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type ExperienceBookingFormProps = {
  experienceId: string;
  activityType: 'PRIVATE' | 'SHARED';
  adultPrice: number;
  childPrice?: number | null;
  infantPrice?: number | null;
  capacity: number;
  schedules: string[];
};

type GuestCounts = {
  adults: number;
  children: number;
  infants: number;
};

const toDateLabel = (value?: string) => {
  if (!value) return 'dd/mm/aaaa';
  const [year, month, day] = value.split('-');
  if (!year || !month || !day) return 'dd/mm/aaaa';
  return `${day}/${month}/${year}`;
};

export function ExperienceBookingForm({
  experienceId,
  activityType,
  adultPrice,
  childPrice,
  infantPrice,
  capacity,
  schedules
}: ExperienceBookingFormProps) {
  const router = useRouter();
  const [csrfToken, setCsrfToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [timeLabel, setTimeLabel] = useState(schedules[0] || '');
  const [guests, setGuests] = useState<GuestCounts>({ adults: 1, children: 0, infants: 0 });

  useEffect(() => {
    fetch('/api/security/csrf')
      .then(async (res) => {
        const data = await res.json();
        setCsrfToken(data.token);
      })
      .catch(() => undefined);
  }, []);

  const totalGuests = guests.adults + guests.children + guests.infants;

  const totals = useMemo(() => {
    const safeAdult = Math.max(0, Number(adultPrice) || 0);
    const safeChild = Math.max(0, Number(childPrice ?? adultPrice) || 0);
    const safeInfant = Math.max(0, Number(infantPrice ?? 0) || 0);
    const total =
      guests.adults * safeAdult + guests.children * safeChild + guests.infants * safeInfant;
    return {
      safeAdult,
      safeChild,
      safeInfant,
      total: Math.round(total * 100) / 100
    };
  }, [adultPrice, childPrice, infantPrice, guests]);

  const updateGuest = (key: keyof GuestCounts, delta: number) => {
    setGuests((prev) => {
      const next = { ...prev, [key]: Math.max(0, prev[key] + delta) };
      if (key === 'adults' && next.adults < 1) {
        next.adults = 1;
      }
      return next;
    });
  };

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (!checkIn || !checkOut) {
      setError('Selecciona check-in y check-out.');
      return;
    }
    if (totalGuests > capacity) {
      setError(`La actividad permite hasta ${capacity} participantes por salida.`);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/experiences/${experienceId}/bookings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken
        },
        body: JSON.stringify({
          checkIn,
          checkOut,
          timeLabel,
          adults: guests.adults,
          children: guests.children,
          infants: guests.infants
        })
      });

      const data = await res.json();
      if (!res.ok) {
        if (res.status === 401) {
          window.location.href = `/auth/sign-in?callbackUrl=${encodeURIComponent(
            `/explorar/${experienceId}`
          )}`;
          return;
        }
        setError(data?.error || 'No se pudo crear la reserva de actividad.');
        return;
      }

      setSuccess(
        data?.status === 'PENDING_APPROVAL'
          ? 'Solicitud enviada. El anfitrion debe aprobar tu reserva.'
          : 'Reserva confirmada correctamente.'
      );
      router.refresh();
    } catch (submitError: any) {
      setError(submitError?.message || 'No se pudo procesar la solicitud.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          <span>Check-in</span>
          <div className="relative">
            <span
              aria-hidden="true"
              className={`pointer-events-none absolute inset-y-0 left-4 flex items-center text-sm normal-case tracking-normal ${
                checkIn ? 'text-slate-900' : 'text-slate-400'
              }`}
            >
              {toDateLabel(checkIn)}
            </span>
            <Calendar
              aria-hidden="true"
              className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
            />
            <Input
              type="date"
              lang="es-AR"
              required
              value={checkIn}
              onChange={(e) => {
                const next = e.target.value;
                setCheckIn(next);
                if (checkOut && next && checkOut < next) {
                  setCheckOut('');
                }
              }}
              className="date-input date-input-overlay w-full text-slate-900"
            />
          </div>
        </label>

        <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          <span>Check-out</span>
          <div className="relative">
            <span
              aria-hidden="true"
              className={`pointer-events-none absolute inset-y-0 left-4 flex items-center text-sm normal-case tracking-normal ${
                checkOut ? 'text-slate-900' : 'text-slate-400'
              }`}
            >
              {toDateLabel(checkOut)}
            </span>
            <Calendar
              aria-hidden="true"
              className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
            />
            <Input
              type="date"
              lang="es-AR"
              required
              min={checkIn || undefined}
              value={checkOut}
              onChange={(e) => setCheckOut(e.target.value)}
              className="date-input date-input-overlay w-full text-slate-900"
            />
          </div>
        </label>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Horario</p>
        <select
          value={timeLabel}
          onChange={(e) => setTimeLabel(e.target.value)}
          className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-700"
        >
          {schedules.map((slot) => (
            <option key={slot} value={slot}>
              {slot}
            </option>
          ))}
        </select>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Viajeros</p>
        <div className="mt-2 space-y-2">
          {[
            { key: 'adults' as const, label: 'Adultos', price: totals.safeAdult },
            { key: 'children' as const, label: 'Ninos', price: totals.safeChild },
            { key: 'infants' as const, label: 'Infantes', price: totals.safeInfant }
          ].map((item) => (
            <div key={item.key} className="flex items-center justify-between text-sm">
              <div>
                <p className="font-medium text-slate-800">{item.label}</p>
                <p className="text-xs text-slate-500">USD {item.price.toFixed(2)}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="h-8 w-8 rounded-full border border-slate-300 text-slate-600"
                  onClick={() => updateGuest(item.key, -1)}
                >
                  -
                </button>
                <span className="w-6 text-center">{guests[item.key]}</span>
                <button
                  type="button"
                  className="h-8 w-8 rounded-full border border-slate-300 text-slate-600"
                  onClick={() => updateGuest(item.key, 1)}
                >
                  +
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-1 text-sm text-slate-600">
        <div className="flex items-center justify-between">
          <span>Total estimado</span>
          <span className="text-xl font-semibold text-slate-900">USD {totals.total.toFixed(2)}</span>
        </div>
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>Participantes</span>
          <span>{totalGuests} / {capacity}</span>
        </div>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}
      {success && <p className="text-xs text-emerald-700">{success}</p>}

      <Button type="submit" size="lg" disabled={loading}>
        {loading ? 'Procesando...' : activityType === 'PRIVATE' ? 'Enviar solicitud' : 'Reservar actividad'}
      </Button>

      <p className="text-xs text-slate-500">
        {activityType === 'PRIVATE'
          ? 'La actividad privada requiere aprobacion del anfitrion.'
          : 'Reserva inmediata sujeta a disponibilidad de cupos.'}
      </p>
    </form>
  );
}
