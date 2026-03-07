'use client';

import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { calculatePrice } from '@/lib/pricing';
import { Calendar } from 'lucide-react';

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

type AvailabilityState = {
  loading: boolean;
  available: boolean | null;
  source?: 'cloudbeds' | 'local';
  message?: string;
  roomTypes?: Array<{ roomTypeId: string; name: string; availableUnits: number }>;
};

type UpsellExperience = {
  id: string;
  title: string;
  city: string;
  zone?: string | null;
  category: string;
  coverageType?: string | null;
  serviceRadiusKm?: number | null;
  pricePerPerson: number;
  photoUrl: string | null;
};

export const BookingForm = ({
  listingId,
  pricePerNight,
  cleaningFee,
  serviceFee,
  taxRate,
  instantBook = true
}: {
  listingId: string;
  pricePerNight: number;
  cleaningFee: number;
  serviceFee: number;
  taxRate: number;
  instantBook?: boolean;
}) => {
  const [csrfToken, setCsrfToken] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [guestOpen, setGuestOpen] = useState(false);
  const [guestError, setGuestError] = useState('');
  const [pendingApprovalThreadId, setPendingApprovalThreadId] = useState<string | null>(null);
  const [priceOverrides, setPriceOverrides] = useState<{ startDate: string; endDate: string; price: number }[]>([]);
  const [availability, setAvailability] = useState<AvailabilityState>({
    loading: false,
    available: null
  });
  const [guests, setGuests] = useState<GuestCounts>({
    adults: 1,
    children: 0,
    infants: 0,
    pets: 0
  });
  const [upsellItems, setUpsellItems] = useState<UpsellExperience[]>([]);
  const [upsellLoading, setUpsellLoading] = useState(true);
  const [selectedUpsellId, setSelectedUpsellId] = useState<string | null>(null);
  const { register, handleSubmit, setValue, watch } = useForm<FormValues>({ resolver: zodResolver(schema) });
  const checkOutRef = useRef<HTMLInputElement | null>(null);
  const checkInField = register('checkIn');
  const checkOutField = register('checkOut');
  const checkIn = watch('checkIn');
  const checkOut = watch('checkOut');

  useEffect(() => {
    if (!checkIn || !checkOut) return;
    fetch(`/api/listings/${listingId}/calendar?from=${checkIn}&to=${checkOut}`)
      .then((res) => res.json())
      .then((data) => setPriceOverrides(data.overrides || []))
      .catch(() => setPriceOverrides([]));
  }, [checkIn, checkOut, listingId]);

  const pricing =
    checkIn && checkOut
      ? calculatePrice({
          checkIn: new Date(checkIn),
          checkOut: new Date(checkOut),
          pricePerNight,
          cleaningFee,
          serviceFee,
          taxRate,
          overrides: priceOverrides.map((o) => ({
            startDate: new Date(o.startDate),
            endDate: new Date(o.endDate),
            price: o.price
          }))
        })
      : null;

  useEffect(() => {
    fetch('/api/security/csrf').then(async (res) => {
      const data = await res.json();
      setCsrfToken(data.token);
    });
  }, []);

  useEffect(() => {
    setUpsellLoading(true);
    fetch(`/api/listings/${listingId}/upsell`)
      .then(async (res) => ({ ok: res.ok, data: await res.json() }))
      .then(({ ok, data }) => {
        if (!ok) {
          setUpsellItems([]);
          return;
        }
        setUpsellItems(Array.isArray(data?.experiences) ? data.experiences : []);
      })
      .catch(() => setUpsellItems([]))
      .finally(() => setUpsellLoading(false));
  }, [listingId]);

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

  const formatDate = (value?: string) => {
    if (!value) return 'dd/mm/aaaa';
    const [year, month, day] = value.split('-');
    if (!year || !month || !day) return 'dd/mm/aaaa';
    return `${day}/${month}/${year}`;
  };

  useEffect(() => {
    if (!checkIn || !checkOut) {
      setAvailability({ loading: false, available: null });
      return;
    }

    setAvailability({ loading: true, available: null });
    fetch(
      `/api/listings/${listingId}/availability?checkIn=${checkIn}&checkOut=${checkOut}&guests=${totalGuests}`
    )
      .then(async (res) => ({ ok: res.ok, data: await res.json() }))
      .then(({ ok, data }) => {
        if (!ok) {
          setAvailability({
            loading: false,
            available: false,
            message: data?.error || 'No se pudo validar disponibilidad'
          });
          return;
        }
        setAvailability({
          loading: false,
          available: Boolean(data?.available),
          source: data?.source,
          message: data?.message,
          roomTypes: Array.isArray(data?.roomTypes) ? data.roomTypes : undefined
        });
      })
      .catch(() => {
        setAvailability({
          loading: false,
          available: false,
          message: 'No se pudo validar disponibilidad'
        });
      });
  }, [checkIn, checkOut, listingId, totalGuests]);

  const onSubmit = async (values: FormValues) => {
    if (guests.adults < 1) {
      setGuestError('Debe haber al menos 1 adulto');
      return;
    }
    if (availability.available === false) {
      setGuestError(availability.message || 'No hay disponibilidad para esas fechas');
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
        guestsBreakdown: guests,
        upsellExperienceId: selectedUpsellId || undefined
      })
    });
    const data = await res.json();
    if (data?.pendingApproval) {
      setPendingApprovalThreadId(data.threadId || null);
      setLoading(false);
      return;
    }
    if (data.checkoutUrl) {
      window.location.href = data.checkoutUrl;
    } else {
      setGuestError(data.error || 'No se pudo iniciar el pago');
    }
    setLoading(false);
  };

  const openCheckoutPicker = () => {
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

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2 min-w-0">
        <label className="flex min-w-0 flex-col gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
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
              type="date"
              lang="es-AR"
              aria-label="Check-in"
              required
              className="date-input date-input-overlay min-w-0 w-full max-w-full overflow-hidden text-slate-900"
              {...checkInField}
              onFocus={(e) => openPickerOnFocus(e.currentTarget)}
              onChange={(e) => {
                checkInField.onChange(e);
                const next = e.target.value;
                if (checkOut && next && checkOut < next) {
                  setValue('checkOut', '');
                }
                if (next) {
                  openCheckoutPicker();
                }
              }}
            />
          </div>
        </label>
        <label className="flex min-w-0 flex-col gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
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
              type="date"
              lang="es-AR"
              aria-label="Check-out"
              required
              min={checkIn || undefined}
              className="date-input date-input-overlay min-w-0 w-full max-w-full overflow-hidden text-slate-900"
              {...checkOutField}
              ref={(node) => {
                checkOutField.ref(node);
                checkOutRef.current = node;
              }}
              onFocus={(e) => openPickerOnFocus(e.currentTarget)}
              onChange={(e) => checkOutField.onChange(e)}
            />
          </div>
        </label>
      </div>

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

      {pricing && !Number.isNaN(pricing.total) && (
        <div className="space-y-2 text-sm text-slate-600">
          <div className="flex items-baseline justify-between rounded-2xl border border-slate-200/70 bg-slate-50/80 px-3 py-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total estimado</span>
            <span className="text-xl font-semibold text-slate-900">USD {pricing.total.toFixed(2)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>{pricing.nights} noches</span>
            <span>USD {pricing.nightlySubtotal.toFixed(2)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Limpieza</span>
            <span>USD {cleaningFee.toFixed(2)}</span>
          </div>
          {serviceFee > 0 && (
            <div className="flex items-center justify-between">
              <span>Tarifa de servicio</span>
              <span>USD {serviceFee.toFixed(2)}</span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span>Impuestos</span>
            <span>USD {pricing.taxes.toFixed(2)}</span>
          </div>
          <div className="flex items-center justify-between font-semibold text-slate-900">
            <span>Total</span>
            <span>USD {pricing.total.toFixed(2)}</span>
          </div>
        </div>
      )}

      {!pricing && (
        <p className="text-xs text-slate-500">Selecciona fechas para ver el total estimado, similar al resumen de Airbnb.</p>
      )}

      {availability.loading && (
        <p className="text-xs text-slate-500">Consultando disponibilidad...</p>
      )}
      {availability.available === true && !availability.loading && (
        <div className="space-y-1">
          <p className="text-xs text-emerald-700">
            Disponible ({availability.source === 'cloudbeds' ? 'Cloudbeds' : 'Hostea'})
          </p>
          {availability.source === 'cloudbeds' &&
            availability.roomTypes &&
            availability.roomTypes.length > 0 && (
              <p className="text-xs text-slate-500">
                {availability.roomTypes
                  .map((room) => `${room.name}: ${room.availableUnits}`)
                  .join(' · ')}
              </p>
            )}
        </div>
      )}
      {availability.available === false && !availability.loading && (
        <p className="text-xs text-red-600">
          {availability.message || 'No disponible para las fechas elegidas'}
        </p>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-3">
        <p className="text-sm font-semibold text-slate-900">
          Aprovecha tu viaje y agrega una experiencia o servicio
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Te mostramos opciones de la misma ciudad y zona del alojamiento.
        </p>

        {upsellLoading ? (
          <p className="mt-3 text-xs text-slate-500">Buscando experiencias cercanas...</p>
        ) : upsellItems.length === 0 ? (
          <p className="mt-3 text-xs text-slate-500">
            No hay experiencias compatibles en esta zona por ahora.
          </p>
        ) : (
          <div className="mt-3 space-y-2">
            {upsellItems.map((experience) => {
              const selected = selectedUpsellId === experience.id;
              return (
                <button
                  type="button"
                  key={experience.id}
                  onClick={() => setSelectedUpsellId(selected ? null : experience.id)}
                  className={`flex w-full items-center gap-3 rounded-2xl border p-2 text-left transition ${
                    selected
                      ? 'border-[var(--brand-2)] bg-[var(--brand-soft)]'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="h-14 w-14 overflow-hidden rounded-xl bg-slate-100">
                    {experience.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={experience.photoUrl}
                        alt={experience.title}
                        className="h-full w-full object-cover"
                      />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-900">{experience.title}</p>
                    <p className="text-xs text-slate-500">
                      {experience.zone ? `${experience.city}, ${experience.zone}` : experience.city}
                    </p>
                    <p className="text-xs text-slate-500">
                      USD {experience.pricePerPerson.toFixed(2)} por persona
                    </p>
                  </div>
                  <span className="text-xs font-semibold text-slate-600">
                    {selected ? 'Agregada' : 'Agregar'}
                  </span>
                </button>
              );
            })}
            {selectedUpsellId && (
              <button
                type="button"
                className="text-xs font-medium text-slate-600 underline underline-offset-2"
                onClick={() => setSelectedUpsellId(null)}
              >
                Lo agrego despues
              </button>
            )}
          </div>
        )}
      </div>

      <Button
        type="submit"
        size="lg"
        disabled={loading || availability.loading || availability.available === false}
      >
        {loading ? 'Procesando...' : instantBook ? 'Reservar ahora' : 'Enviar solicitud'}
      </Button>

      {pendingApprovalThreadId !== null && (
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
          <p className="font-semibold">Solicitud enviada</p>
          <p className="mt-1 text-blue-800">
            El anfitrion debe aprobar tu reserva. Te avisaremos cuando este confirmada.
          </p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="mt-3"
            onClick={() =>
              (window.location.href = pendingApprovalThreadId
                ? `/dashboard/client/messages?threadId=${pendingApprovalThreadId}`
                : '/dashboard/client/messages')
            }
          >
            Volver a mensajes
          </Button>
        </div>
      )}
    </form>
  );
};
