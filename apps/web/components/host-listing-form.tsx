'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  calcBreakdown,
  calcClientPriceFromHostNet,
  defaultSmartPricingParams,
  withSmartPricingParams
} from '@/lib/intelligent-pricing';
import { type BookingMode, bookingModeLabel } from '@/lib/booking-mode';
import { getCitiesByCountry, getCountries, getNeighborhoods } from '@/lib/location-presets';

const amenityOptions = [
  'Wifi',
  'Cocina',
  'Espacios comunes',
  'Aire acondicionado',
  'Estacionamiento',
  'TV',
  'Zona de trabajo'
];

const money = (value: number) => `USD ${Number(value || 0).toFixed(2)}`;

export const HostListingForm = () => {
  const router = useRouter();
  const countries = getCountries();
  const initialCountry = countries[0] || 'Argentina';
  const initialCity = getCitiesByCountry(initialCountry)[0] || '';
  const initialNeighborhood = getNeighborhoods(initialCountry, initialCity)[0] || '';
  const [csrf, setCsrf] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [saving, setSaving] = useState(false);
  const [pricingParams, setPricingParams] = useState(defaultSmartPricingParams);
  const [form, setForm] = useState({
    title: '',
    description: '',
    type: 'APARTMENT',
    inventoryQty: 1,
    address: '',
    country: initialCountry,
    city: initialCity,
    neighborhood: initialNeighborhood,
    netoDeseadoUsd: 40,
    capacity: 2,
    beds: 1,
    baths: 1,
    checkInTime: '15:00',
    checkOutTime: '11:00',
    allowChildren: true,
    allowPets: false,
    allowSmoking: false,
    allowParties: false,
    amenityNames: ['Wifi', 'Cocina'],
    cancelPolicy: 'FLEXIBLE',
    bookingMode: 'instant' as BookingMode
  });

  useEffect(() => {
    fetch('/api/security/csrf')
      .then(async (res) => {
        const data = await res.json();
        setCsrf(data.token);
      })
      .catch(() => undefined);

    fetch('/api/settings')
      .then((res) => res.json())
      .then((data) => {
        const platformPct = Number(data?.settings?.commissionPercent);
        setPricingParams((current) =>
          withSmartPricingParams({
            stripePct: current.stripePct,
            stripeFixed: current.stripeFixed,
            platformPct: Number.isFinite(platformPct) ? platformPct : current.platformPct
          })
        );
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const availableCities = getCitiesByCountry(form.country);
    if (!availableCities.includes(form.city)) {
      const nextCity = availableCities[0] || '';
      const nextNeighborhood = getNeighborhoods(form.country, nextCity)[0] || '';
      setForm((prev) => ({ ...prev, city: nextCity, neighborhood: nextNeighborhood }));
      return;
    }
    const availableNeighborhoods = getNeighborhoods(form.country, form.city);
    if (!availableNeighborhoods.includes(form.neighborhood)) {
      setForm((prev) => ({
        ...prev,
        neighborhood: availableNeighborhoods[0] || ''
      }));
    }
  }, [form.country, form.city, form.neighborhood]);

  const calculatedPrice = useMemo(
    () => calcClientPriceFromHostNet(form.netoDeseadoUsd, pricingParams),
    [form.netoDeseadoUsd, pricingParams]
  );
  const breakdown = useMemo(
    () => calcBreakdown(calculatedPrice, pricingParams),
    [calculatedPrice, pricingParams]
  );

  const onSubmit = async () => {
    setErrorMsg('');
    setSaving(true);
    const payload = {
      ...form,
      pricePerNight: calculatedPrice,
      netoDeseadoUsd: form.netoDeseadoUsd,
      precioClienteCalculadoUsd: calculatedPrice,
      bookingMode: form.bookingMode
    };
    const res = await fetch('/api/host/listings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': csrf
      },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) {
      const issues = Array.isArray(data?.issues)
        ? ` (${data.issues.map((i: any) => i.path?.join('.') || 'campo').join(', ')})`
        : '';
      setErrorMsg((data?.error || 'No se pudo crear el listing.') + issues);
      setSaving(false);
      return;
    }
    if (data.listing?.id) {
      router.push('/dashboard/host/listings?created=1');
      return;
    }
    setSaving(false);
  };

  return (
    <div className="surface-card">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Nuevo listing</h2>
          <p className="text-sm text-slate-500">Completa los datos principales para publicar.</p>
        </div>
        <Button size="sm" onClick={onSubmit} disabled={saving}>
          {saving ? 'Creando...' : 'Crear listing'}
        </Button>
      </div>

      {errorMsg && <p className="mt-3 text-sm text-red-600">{errorMsg}</p>}

      <div className="mt-6 grid gap-3 md:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Titulo</p>
          <Input
            placeholder="Ej: Loft moderno en Palermo"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Descripcion</p>
          <Input
            placeholder="Breve descripcion del espacio"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Direccion</p>
          <Input
            placeholder="Calle y numero"
            value={form.address}
            onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
          />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Pais</p>
          <select
            className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm"
            value={form.country}
            onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
          >
            {countries.map((country) => (
              <option key={country} value={country}>
                {country}
              </option>
            ))}
          </select>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Ciudad</p>
          <select
            className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm"
            value={form.city}
            onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
          >
            {getCitiesByCountry(form.country).map((city) => (
              <option key={city} value={city}>
                {city}
              </option>
            ))}
          </select>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Barrio / zona</p>
          <select
            className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm"
            value={form.neighborhood}
            onChange={(e) => setForm((f) => ({ ...f, neighborhood: e.target.value }))}
          >
            {getNeighborhoods(form.country, form.city).map((neighborhood) => (
              <option key={neighborhood} value={neighborhood}>
                {neighborhood}
              </option>
            ))}
          </select>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Neto deseado por noche (USD)
          </p>
          <Input
            type="number"
            min={0}
            step="0.01"
            placeholder="40"
            value={form.netoDeseadoUsd}
            onChange={(e) =>
              setForm((f) => ({ ...f, netoDeseadoUsd: Math.max(0, Number(e.target.value) || 0) }))
            }
          />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Precio cliente calculado (USD)
          </p>
          <Input type="number" value={calculatedPrice} disabled readOnly />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Capacidad (huespedes)
          </p>
          <Input
            type="number"
            placeholder="2"
            value={form.capacity}
            onChange={(e) => setForm((f) => ({ ...f, capacity: Number(e.target.value) }))}
          />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Camas</p>
          <Input
            type="number"
            placeholder="1"
            value={form.beds}
            onChange={(e) => setForm((f) => ({ ...f, beds: Number(e.target.value) }))}
          />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Banos</p>
          <Input
            type="number"
            placeholder="1"
            value={form.baths}
            onChange={(e) => setForm((f) => ({ ...f, baths: Number(e.target.value) }))}
          />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Check-in (hora)</p>
          <Input
            type="time"
            value={form.checkInTime}
            onChange={(e) => setForm((f) => ({ ...f, checkInTime: e.target.value }))}
          />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Check-out (hora)</p>
          <Input
            type="time"
            value={form.checkOutTime}
            onChange={(e) => setForm((f) => ({ ...f, checkOutTime: e.target.value }))}
          />
        </div>
        <select
          className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-xs font-semibold uppercase tracking-wide"
          value={form.type}
          onChange={(e) =>
            setForm((f) => ({
              ...f,
              type: e.target.value,
              inventoryQty: e.target.value === 'HOTEL' ? Math.max(1, f.inventoryQty) : 1
            }))
          }
        >
          <option value="APARTMENT">APARTMENT</option>
          <option value="HOTEL">HOTEL</option>
        </select>
        {form.type === 'HOTEL' ? (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Cantidad de habitaciones disponibles (este anuncio)
            </p>
            <Input
              type="number"
              min={1}
              placeholder="1"
              value={form.inventoryQty}
              onChange={(e) =>
                setForm((f) => ({ ...f, inventoryQty: Math.max(1, Number(e.target.value) || 1) }))
              }
            />
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-200/70 bg-slate-50 px-4 py-3 text-xs text-slate-500">
            Departamento: inventario fijo en 1 unidad.
          </div>
        )}
        <select
          className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-xs font-semibold uppercase tracking-wide"
          value={form.cancelPolicy}
          onChange={(e) => setForm((f) => ({ ...f, cancelPolicy: e.target.value }))}
        >
          <option value="FLEXIBLE">FLEXIBLE</option>
          <option value="MODERATE">MODERATE</option>
          <option value="STRICT">STRICT</option>
        </select>

        <div className="md:col-span-2 rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Modo de reservas</p>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {(['instant', 'approval'] as BookingMode[]).map((mode) => {
              const selected = form.bookingMode === mode;
              return (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, bookingMode: mode }))}
                  className={`rounded-2xl border px-4 py-3 text-left text-sm transition ${
                    selected
                      ? 'border-slate-900 bg-slate-50 text-slate-900'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                  }`}
                >
                  <p className="font-semibold">{bookingModeLabel(mode)}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {mode === 'instant'
                      ? 'El huesped confirma al instante. Recomendado solo si tu disponibilidad esta 100% controlada.'
                      : 'Recibes solicitud y apruebas manualmente. Recomendado si usas iCal o varios canales.'}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
        <div className="md:col-span-2 rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Comodidades</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {amenityOptions.map((amenity) => {
              const selected = form.amenityNames.includes(amenity);
              return (
                <button
                  key={amenity}
                  type="button"
                  onClick={() =>
                    setForm((prev) => ({
                      ...prev,
                      amenityNames: selected
                        ? prev.amenityNames.filter((item) => item !== amenity)
                        : [...prev.amenityNames, amenity]
                    }))
                  }
                  className={`rounded-xl border px-3 py-2 text-left text-sm transition ${
                    selected
                      ? 'border-slate-900 bg-slate-50 text-slate-900'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                  }`}
                >
                  {amenity}
                </button>
              );
            })}
          </div>
        </div>
        <div className="md:col-span-2 rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Reglas del alojamiento</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {[
              { key: 'allowChildren' as const, label: 'Se permiten ninos' },
              { key: 'allowPets' as const, label: 'Se permiten mascotas' },
              { key: 'allowSmoking' as const, label: 'Se permite fumar' },
              { key: 'allowParties' as const, label: 'Se permiten eventos' }
            ].map((rule) => (
              <label
                key={rule.key}
                className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700"
              >
                <input
                  type="checkbox"
                  checked={form[rule.key]}
                  onChange={(e) => setForm((prev) => ({ ...prev, [rule.key]: e.target.checked }))}
                />
                {rule.label}
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-semibold text-slate-900">Precio inteligente (estimado)</p>
          <div className="text-xs text-slate-500">Montos finales estimados en USD.</div>
        </div>
        <div className="mt-3 space-y-1 text-sm text-slate-600">
          <div className="flex items-center justify-between">
            <span>Precio al cliente</span>
            <span>{money(calculatedPrice)}</span>
          </div>
          <div className="flex items-center justify-between text-slate-500">
            <span>Cargos administrativos</span>
            <span>-{money(breakdown.stripeFee)}</span>
          </div>
          <div className="flex items-center justify-between text-slate-500">
            <span>Tarifa de servicio (anfitrion)</span>
            <span>-{money(breakdown.platformFee)}</span>
          </div>
          <div className="flex items-center justify-between font-semibold text-slate-900">
            <span>Neto final a recibir por el anfitrion</span>
            <span>{money(breakdown.hostNet)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
