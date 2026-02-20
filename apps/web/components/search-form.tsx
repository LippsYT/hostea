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
  const [checkInActive, setCheckInActive] = useState(false);
  const [checkOutActive, setCheckOutActive] = useState(false);
  const checkInRef = useRef<HTMLInputElement | null>(null);
  const checkOutRef = useRef<HTMLInputElement | null>(null);
  const [guests, setGuests] = useState('2');

  const openCheckOutPicker = () => {
    const target = checkOutRef.current;
    if (!target) return;

    setCheckOutActive(true);
    target.focus();

    try {
      if (typeof (target as HTMLInputElement & { showPicker?: () => void }).showPicker === 'function') {
        (target as HTMLInputElement & { showPicker?: () => void }).showPicker?.();
      }
    } catch {
      // iOS Safari can block programmatic picker opening.
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
    <form onSubmit={onSubmit} className="mt-4 grid gap-3">
      <Input placeholder="Destino o zona" value={city} onChange={(e) => setCity(e.target.value)} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          <span>Check-in</span>
          <Input
            ref={checkInRef}
            className="date-input min-w-0 text-slate-900"
            type={checkInActive || Boolean(checkIn) ? 'date' : 'text'}
            lang="es-AR"
            aria-label="Check-in"
            placeholder="dd/mm/aaaa"
            value={checkIn}
            onFocus={() => {
              setCheckInActive(true);
              window.requestAnimationFrame(() => {
                const target = checkInRef.current;
                if (!target) return;
                try {
                  if (typeof (target as HTMLInputElement & { showPicker?: () => void }).showPicker === 'function') {
                    (target as HTMLInputElement & { showPicker?: () => void }).showPicker?.();
                  }
                } catch {
                  // iOS Safari can block programmatic picker opening.
                }
              });
            }}
            onBlur={() => {
              if (!checkIn) setCheckInActive(false);
            }}
            onChange={(e) => {
              const next = e.target.value;
              setCheckIn(next);

              if (checkOut && next && checkOut < next) {
                setCheckOut('');
              }

              if (next) {
                window.requestAnimationFrame(openCheckOutPicker);
              }
            }}
          />
        </label>
        <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          <span>Check-out</span>
          <Input
            ref={checkOutRef}
            className="date-input min-w-0 text-slate-900"
            type={checkOutActive || Boolean(checkOut) ? 'date' : 'text'}
            lang="es-AR"
            aria-label="Check-out"
            placeholder="dd/mm/aaaa"
            min={checkIn || undefined}
            value={checkOut}
            onFocus={() => {
              setCheckOutActive(true);
              window.requestAnimationFrame(() => {
                const target = checkOutRef.current;
                if (!target) return;
                try {
                  if (typeof (target as HTMLInputElement & { showPicker?: () => void }).showPicker === 'function') {
                    (target as HTMLInputElement & { showPicker?: () => void }).showPicker?.();
                  }
                } catch {
                  // iOS Safari can block programmatic picker opening.
                }
              });
            }}
            onBlur={() => {
              if (!checkOut) setCheckOutActive(false);
            }}
            onChange={(e) => setCheckOut(e.target.value)}
          />
        </label>
      </div>
      <Input placeholder="Huespedes" value={guests} onChange={(e) => setGuests(e.target.value)} />
      <Button type="submit" className="w-full">
        Buscar
      </Button>
    </form>
  );
};
