'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Search, User, ArrowLeft, Home, Sparkles, Briefcase, Users } from 'lucide-react';

type GuestCounts = {
  adults: number;
  children: number;
  infants: number;
  pets: number;
};

export const ListingHeader = () => {
  const router = useRouter();
  const { data: session } = useSession();
  const [expanded, setExpanded] = useState(false);
  const [tab, setTab] = useState<'homes' | 'experiences' | 'services'>('homes');
  const [guests, setGuests] = useState<GuestCounts>({ adults: 1, children: 0, infants: 0, pets: 0 });
  const [location, setLocation] = useState('');
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');

  const totalGuests = guests.adults + guests.children + guests.infants;
  const guestSummary = `${totalGuests} huesped${totalGuests === 1 ? '' : 'es'}` + (guests.pets ? `, ${guests.pets} mascota${guests.pets === 1 ? '' : 's'}` : '');

  const updateGuest = (key: keyof GuestCounts, delta: number) => {
    setGuests((prev) => {
      const next = { ...prev, [key]: Math.max(0, prev[key] + delta) };
      if (key === 'adults' && next.adults < 1) {
        next.adults = 1;
      }
      return next;
    });
  };

  const onSearch = () => {
    const params = new URLSearchParams();
    if (location.trim()) params.set('city', location.trim());
    if (checkIn) params.set('checkIn', checkIn);
    if (checkOut) params.set('checkOut', checkOut);
    params.set('guests', String(totalGuests || 1));
    router.push(`/search?${params.toString()}`);
    setExpanded(false);
  };

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver
          </Link>
          <Link href="/" className="text-lg font-semibold tracking-tight text-slate-900">
            HOSTEA
          </Link>
        </div>

        <div className="hidden items-center gap-6 text-xs text-slate-500 md:flex">
          {[
            { key: 'homes', label: 'Alojamientos', icon: Home },
            { key: 'experiences', label: 'Experiencias', icon: Sparkles },
            { key: 'services', label: 'Servicios', icon: Briefcase }
          ].map((item) => (
            <button
              key={item.key}
              onClick={() => setTab(item.key as typeof tab)}
              className={`flex items-center gap-2 rounded-full px-3 py-1 transition ${tab === item.key ? 'bg-slate-900 text-white' : 'hover:text-slate-900'}`}
            >
              <item.icon className={`h-4 w-4 ${tab === item.key ? '' : 'float-slow'}`} />
              {item.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/dashboard"
            className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600 hover:bg-slate-50"
          >
            Panel
          </Link>
          {session ? (
            <Link
              href="/dashboard"
              className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600 hover:bg-slate-50"
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 text-[10px] font-semibold text-white">
                {(session.user?.name || session.user?.email || 'U')
                  .split(' ')
                  .map((part) => part[0])
                  .slice(0, 2)
                  .join('')
                  .toUpperCase()}
              </span>
              Perfil
            </Link>
          ) : (
            <Link
              href="/auth/sign-in"
              className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600 hover:bg-slate-50"
            >
              <User className="h-4 w-4" />
              Perfil
            </Link>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-6 pb-4">
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className={`mx-auto flex w-full items-center justify-between rounded-full border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm transition md:w-[640px] ${expanded ? 'scale-[1.01] shadow-lg' : ''}`}
        >
          <span className="font-semibold text-slate-900">{location || 'Cualquier lugar'}</span>
          <span className="h-5 w-px bg-slate-200" />
          <span className="text-slate-600">{checkIn && checkOut ? `${checkIn} · ${checkOut}` : 'Semana flexible'}</span>
          <span className="h-5 w-px bg-slate-200" />
          <span className="text-slate-600">{guestSummary}</span>
          <span className="ml-2 flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-white">
            <Search className="h-4 w-4" />
          </span>
        </button>

        {expanded && (
          <div className="mx-auto mt-4 w-full rounded-3xl border border-slate-200 bg-white p-4 shadow-xl md:w-[640px]">
            <div className="grid gap-3 md:grid-cols-[1.2fr_1fr_1fr]">
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Lugar</p>
                <input
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Explorar destinos"
                  className="mt-1 w-full text-sm text-slate-700 outline-none"
                />
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Fechas</p>
                <div className="mt-1 grid grid-cols-2 gap-2">
                  <input
                    type="date"
                    value={checkIn}
                    onChange={(e) => setCheckIn(e.target.value)}
                    className="w-full text-xs text-slate-700 outline-none"
                  />
                  <input
                    type="date"
                    value={checkOut}
                    onChange={(e) => setCheckOut(e.target.value)}
                    className="w-full text-xs text-slate-700 outline-none"
                  />
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Viajeros</p>
                <p className="text-slate-700">{guestSummary}</p>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
              {[
                { label: 'Adultos', sub: '13+ años', key: 'adults' },
                { label: 'Niños', sub: '2-12 años', key: 'children' },
                { label: 'Bebés', sub: 'Menos de 2', key: 'infants' },
                { label: 'Mascotas', sub: 'Servicio', key: 'pets' }
              ].map((item) => (
                <div key={item.key} className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-slate-400" />
                    <div>
                      <p className="text-sm font-medium text-slate-900">{item.label}</p>
                      <p className="text-xs text-slate-500">{item.sub}</p>
                    </div>
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
            </div>

            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={onSearch}
                className="flex items-center gap-2 rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-800"
              >
                <Search className="h-4 w-4" />
                Buscar
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};
