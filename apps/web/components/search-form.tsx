'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Calendar } from 'lucide-react';

export const SearchForm = () => {
  const router = useRouter();
  const [city, setCity] = useState('');
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const checkOutRef = useRef<HTMLInputElement | null>(null);
  const [guests, setGuests] = useState('2');

  const formatDate = (value: string) => {
    if (!value) return 'dd/mm/aaaa';
    const [year, month, day] = value.split('-');
    if (!year || !month || !day) return 'dd/mm/aaaa';
    return `${day}/${month}/${year}`;
  };

  const openCheckOutPicker = () => {
    const target = checkOutRef.current;
    if (!target) return;
    target.focus();
    try {
      if (typeof (target as HTMLInputElement & { showPicker?: () => void }).showPicker === 'function') {
        (target as HTMLInputElement & { showPicker?: () => void }).showPicker?.();
      }
    } catch {
      // iOS Safari can block programmatic picker opening.
    }
  };

  const openPickerOnFocus = (target: HTMLInputElement) => {
    try {
      if (typeof (target as HTMLInputElement & { showPicker?: () => void }).showPicker === 'function') {
        (target as HTMLInputElement & { showPicker?: () => void }).showPicker?.();
      }
    } catch {
      // Browser can block programmatic picker opening.
    }
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (city) params.set('city', city);
    if (checkIn) params.set('checkIn', checkIn);
    if (checkOut) params.set('checkOut', checkOut);
    if (guests) params.set('guests', guests);
    router.push(`/search?${params.toString()}`);
  };

  return (
    <form onSubmit={onSubmit} className="mt-4 grid w-full max-w-full min-w-0 gap-3 overflow-hidden">
      <Input
        className="w-full max-w-full min-w-0"
        placeholder="Destino o zona"
        value={city}
        onChange={(e) => setCity(e.target.value)}
      />
      <div className="grid w-full max-w-full min-w-0 grid-cols-1 gap-3 md:grid-cols-2">
        <label className="flex w-full max-w-full min-w-0 flex-col gap-2 overflow-hidden text-xs font-semibold uppercase tracking-wide text-slate-500">
          <span>Check-in</span>
          <div className="relative min-w-0">
            <span
              aria-hidden="true"
              className={`pointer-events-none absolute inset-y-0 left-4 flex items-center text-sm normal-case tracking-normal ${
                checkIn ? 'text-slate-900' : 'text-slate-400'
              }`}
            >
              {formatDate(checkIn)}
            </span>
            <Calendar
              aria-hidden="true"
              className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
            />
            <Input
              className="date-input w-full max-w-full min-w-0 overflow-hidden text-transparent"
              type="date"
              lang="es-AR"
              aria-label="Check-in"
              required
              value={checkIn}
              onFocus={(e) => openPickerOnFocus(e.currentTarget)}
              onChange={(e) => {
                const next = e.target.value;
                setCheckIn(next);

                if (checkOut && next && checkOut < next) {
                  setCheckOut('');
                }

                if (next) {
                  openCheckOutPicker();
                }
              }}
            />
          </div>
        </label>
        <label className="flex w-full max-w-full min-w-0 flex-col gap-2 overflow-hidden text-xs font-semibold uppercase tracking-wide text-slate-500">
          <span>Check-out</span>
          <div className="relative min-w-0">
            <span
              aria-hidden="true"
              className={`pointer-events-none absolute inset-y-0 left-4 flex items-center text-sm normal-case tracking-normal ${
                checkOut ? 'text-slate-900' : 'text-slate-400'
              }`}
            >
              {formatDate(checkOut)}
            </span>
            <Calendar
              aria-hidden="true"
              className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
            />
            <Input
              ref={checkOutRef}
              className="date-input w-full max-w-full min-w-0 overflow-hidden text-transparent"
              type="date"
              lang="es-AR"
              aria-label="Check-out"
              required
              min={checkIn || undefined}
              value={checkOut}
              onFocus={(e) => openPickerOnFocus(e.currentTarget)}
              onChange={(e) => setCheckOut(e.target.value)}
            />
          </div>
        </label>
      </div>
      <Input
        className="w-full max-w-full min-w-0"
        placeholder="Huespedes"
        value={guests}
        onChange={(e) => setGuests(e.target.value)}
      />
      <Button type="submit" className="w-full">
        Buscar
      </Button>
    </form>
  );
};
