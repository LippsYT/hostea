'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { Calendar, Compass, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { OccupancySelector } from '@/components/occupancy-selector';
import { buildAgeRulesSummary, buildOccupancySummary } from '@/lib/occupancy';

type SearchMode = 'lodging' | 'activity';

type SearchFormProps = {
  mode?: SearchMode | 'dual';
  initialMode?: SearchMode;
  initialValues?: {
    city?: string;
    checkIn?: string;
    checkOut?: string;
    date?: string;
    adults?: number;
    children?: number;
    infants?: number;
  };
  className?: string;
  compact?: boolean;
};

const getTodayIso = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatDate = (value: string) => {
  if (!value) return 'dd/mm/aaaa';
  const [year, month, day] = value.split('-');
  if (!year || !month || !day) return 'dd/mm/aaaa';
  return `${day}/${month}/${year}`;
};

const addDaysIso = (value: string, days: number) => {
  const base = new Date(`${value}T00:00:00`);
  if (Number.isNaN(base.getTime())) return value;
  base.setDate(base.getDate() + days);
  const year = base.getFullYear();
  const month = String(base.getMonth() + 1).padStart(2, '0');
  const day = String(base.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export function SearchForm({
  mode = 'dual',
  initialMode = 'lodging',
  initialValues,
  className = '',
  compact = false
}: SearchFormProps) {
  const router = useRouter();
  const todayIso = getTodayIso();
  const [activeMode, setActiveMode] = useState<SearchMode>(
    mode === 'dual' ? initialMode : mode
  );
  const [city, setCity] = useState(initialValues?.city ?? '');
  const [checkIn, setCheckIn] = useState(initialValues?.checkIn ?? '');
  const [checkOut, setCheckOut] = useState(initialValues?.checkOut ?? '');
  const [activityDate, setActivityDate] = useState(initialValues?.date ?? '');
  const [guests, setGuests] = useState({
    adults: Math.max(1, initialValues?.adults ?? 2),
    children: Math.max(0, initialValues?.children ?? 0),
    infants: Math.max(0, initialValues?.infants ?? 0)
  });
  const [guestOpen, setGuestOpen] = useState(false);
  const checkOutRef = useRef<HTMLInputElement | null>(null);

  const totalGuests = guests.adults + guests.children + guests.infants;

  const openPickerOnFocus = (target: HTMLInputElement) => {
    try {
      if (typeof (target as HTMLInputElement & { showPicker?: () => void }).showPicker === 'function') {
        (target as HTMLInputElement & { showPicker?: () => void }).showPicker?.();
      }
    } catch {
      // Browser can block programmatic picker opening.
    }
  };

  const openCheckOutPicker = () => {
    const target = checkOutRef.current;
    if (!target) return;
    target.focus();
    openPickerOnFocus(target);
  };

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const params = new URLSearchParams();
    if (city.trim()) params.set('city', city.trim());
    params.set('adults', String(guests.adults));
    params.set('children', String(guests.children));
    params.set('infants', String(guests.infants));
    params.set('guests', String(totalGuests));

    if (activeMode === 'activity') {
      if (activityDate) params.set('date', activityDate);
      router.push(`/explorar?${params.toString()}`);
      return;
    }

    if (checkIn) params.set('checkIn', checkIn);
    if (checkOut) params.set('checkOut', checkOut);
    router.push(`/search?${params.toString()}`);
  };

  const surfaceClass = compact
    ? 'grid gap-3'
    : 'grid gap-4';

  return (
    <form onSubmit={onSubmit} className={`${surfaceClass} ${className}`.trim()}>
      {mode === 'dual' ? (
        <div className="grid grid-cols-2 gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-1">
          {[
            { key: 'lodging' as const, label: 'Alojamientos', icon: Home },
            { key: 'activity' as const, label: 'Actividades', icon: Compass }
          ].map((item) => {
            const Icon = item.icon;
            const selected = activeMode === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setActiveMode(item.key)}
                className={`flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition ${
                  selected
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </button>
            );
          })}
        </div>
      ) : null}

      <Input
        className="w-full"
        placeholder={activeMode === 'activity' ? 'Destino o zona para la actividad' : 'Destino o zona'}
        value={city}
        onChange={(event) => setCity(event.target.value)}
      />

      {activeMode === 'lodging' ? (
        <div className="grid gap-3 md:grid-cols-2">
          <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <span>Check-in</span>
            <div className="relative">
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
                type="date"
                lang="es-AR"
                required
                min={todayIso}
                value={checkIn}
                className="date-input date-input-overlay w-full text-slate-900"
                onFocus={(event) => openPickerOnFocus(event.currentTarget)}
                onChange={(event) => {
                  const next = event.target.value;
                  const normalized = next && next < todayIso ? todayIso : next;
                  setCheckIn(normalized);
                  if (checkOut && normalized && checkOut <= normalized) {
                    setCheckOut('');
                  }
                  if (normalized) openCheckOutPicker();
                }}
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
                {formatDate(checkOut)}
              </span>
              <Calendar
                aria-hidden="true"
                className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
              />
              <Input
                ref={checkOutRef}
                type="date"
                lang="es-AR"
                required
                min={checkIn ? addDaysIso(checkIn, 1) : todayIso}
                value={checkOut}
                className="date-input date-input-overlay w-full text-slate-900"
                onFocus={(event) => openPickerOnFocus(event.currentTarget)}
                onChange={(event) => {
                  const minCheckout = checkIn ? addDaysIso(checkIn, 1) : todayIso;
                  setCheckOut(
                    event.target.value && event.target.value < minCheckout
                      ? minCheckout
                      : event.target.value
                  );
                }}
              />
            </div>
          </label>
        </div>
      ) : (
        <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          <span>Fecha de actividad</span>
          <div className="relative">
            <span
              aria-hidden="true"
              className={`pointer-events-none absolute inset-y-0 left-4 flex items-center text-sm normal-case tracking-normal ${
                activityDate ? 'text-slate-900' : 'text-slate-400'
              }`}
            >
              {formatDate(activityDate)}
            </span>
            <Calendar
              aria-hidden="true"
              className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
            />
            <Input
              type="date"
              lang="es-AR"
              min={todayIso}
              value={activityDate}
              className="date-input date-input-overlay w-full text-slate-900"
              onFocus={(event) => openPickerOnFocus(event.currentTarget)}
              onChange={(event) => {
                const next = event.target.value;
                setActivityDate(next && next < todayIso ? todayIso : next);
              }}
            />
          </div>
        </label>
      )}

      <div>
        <button
          type="button"
          onClick={() => setGuestOpen((current) => !current)}
          className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left"
        >
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Personas</p>
            <p className="mt-1 break-words text-sm leading-snug text-slate-900">
              {buildOccupancySummary(guests)}
            </p>
          </div>
          <span className="shrink-0 text-xs font-semibold text-slate-500">
            {guestOpen ? 'Cerrar' : 'Editar'}
          </span>
        </button>

        {guestOpen ? (
          <div className="mt-2 w-full">
            <OccupancySelector
              value={guests}
              onChange={setGuests}
              helperText={buildAgeRulesSummary()}
              className="shadow-2xl"
              summaryClassName="font-semibold"
            />
          </div>
        ) : null}
      </div>

      <Button type="submit" className="w-full" size={compact ? 'md' : 'lg'}>
        {activeMode === 'activity' ? 'Buscar actividades' : 'Buscar alojamientos'}
      </Button>
    </form>
  );
}
