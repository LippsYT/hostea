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
          <div className="relative">
            {!checkIn && (
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                dd/mm/aaaa
              </span>
            )}
            <Input
              className="appearance-none text-slate-900"
              type="date"
              value={checkIn}
              onChange={(e) => {
                const next = e.target.value;
                setCheckIn(next);
                if (checkOut && next && checkOut < next) {
                  setCheckOut('');
                }
                if (next) {
                  const target = checkOutRef.current;
                  if (target) {
                    target.focus();
                    if (typeof (target as any).showPicker === 'function') {
                      (target as any).showPicker();
                    }
                  }
                }
              }}
            />
          </div>
        </label>
        <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          <span>Check-out</span>
          <div className="relative">
            {!checkOut && (
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                dd/mm/aaaa
              </span>
            )}
            <Input
              ref={checkOutRef}
              className="appearance-none text-slate-900"
              type="date"
              min={checkIn || undefined}
              value={checkOut}
              onChange={(e) => setCheckOut(e.target.value)}
            />
          </div>
        </label>
      </div>
      <Input placeholder="Huéspedes" value={guests} onChange={(e) => setGuests(e.target.value)} />
      <Button type="submit" className="w-full">Buscar</Button>
    </form>
  );
};
