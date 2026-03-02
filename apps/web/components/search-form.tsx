'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export const SearchForm = () => {
  const router = useRouter();
  const [city, setCity] = useState('');
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const checkOutRef = useRef<HTMLInputElement | null>(null);
  const [guests, setGuests] = useState('2');

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
    <form onSubmit={onSubmit} className="mt-4 grid min-w-0 gap-3">
      <Input placeholder="Destino o zona" value={city} onChange={(e) => setCity(e.target.value)} />
      <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex min-w-0 flex-col gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          <span>Check-in</span>
          <div className="relative min-w-0">
            <Input
              className="peer date-input w-full max-w-full min-w-0 overflow-hidden text-slate-900"
              type="date"
              lang="es-AR"
              placeholder="dd/mm/aaaa"
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
            {!checkIn ? (
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm normal-case tracking-normal text-slate-400 peer-focus:opacity-0">
                dd/mm/aaaa
              </span>
            ) : null}
          </div>
        </label>
        <label className="flex min-w-0 flex-col gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          <span>Check-out</span>
          <div className="relative min-w-0">
            <Input
              ref={checkOutRef}
              className="peer date-input w-full max-w-full min-w-0 overflow-hidden text-slate-900"
              type="date"
              lang="es-AR"
              placeholder="dd/mm/aaaa"
              aria-label="Check-out"
              required
              min={checkIn || undefined}
              value={checkOut}
              onFocus={(e) => openPickerOnFocus(e.currentTarget)}
              onChange={(e) => setCheckOut(e.target.value)}
            />
            {!checkOut ? (
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm normal-case tracking-normal text-slate-400 peer-focus:opacity-0">
                dd/mm/aaaa
              </span>
            ) : null}
          </div>
        </label>
      </div>
      <Input placeholder="Huespedes" value={guests} onChange={(e) => setGuests(e.target.value)} />
      <Button type="submit" className="w-full">
        Buscar
      </Button>
    </form>
  );
};
