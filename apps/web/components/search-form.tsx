'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export const SearchForm = () => {
  const router = useRouter();
  const [city, setCity] = useState('');
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
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
        <Input
          type="date"
          value={checkIn}
          onChange={(e) => {
            const next = e.target.value;
            setCheckIn(next);
            if (checkOut && next && checkOut < next) {
              setCheckOut('');
            }
          }}
        />
        {checkIn ? (
          <Input
            type="date"
            min={checkIn}
            value={checkOut}
            onChange={(e) => setCheckOut(e.target.value)}
          />
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white/70 px-4 py-3 text-sm text-slate-500">
            Elegí check-in para seleccionar check-out
          </div>
        )}
      </div>
      <Input placeholder="Huéspedes" value={guests} onChange={(e) => setGuests(e.target.value)} />
      <Button type="submit" className="w-full">Buscar</Button>
    </form>
  );
};
