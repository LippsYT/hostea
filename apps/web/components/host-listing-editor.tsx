'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  calcBreakdown,
  calcClientPriceFromHostNet,
  defaultSmartPricingParams,
  withSmartPricingParams
} from '@/lib/intelligent-pricing';
import {
  type BookingMode,
  bookingModeFromInstantBook,
  bookingModeLabel
} from '@/lib/booking-mode';

type Photo = { id: string; url: string; sortOrder: number };
type IcalFeed = {
  id: string;
  provider: string | null;
  url: string;
  isActive: boolean;
  lastSyncAt: string | null;
  lastSyncStatus: string;
  lastSyncError: string | null;
};
type DynamicPricingForm = {
  enabled: boolean;
  basePrice: number;
  minPrice: number;
  maxPrice: number;
};
type DynamicPreview = {
  date: string;
  basePrice: number;
  occupancyRate: number;
  occupancyAdjustmentPct: number;
  leadTimeDays: number;
  leadTimeAdjustmentPct: number;
  dayOfWeekAdjustmentPct: number;
  finalPrice: number;
};

export type ListingEditorProps = {
  listing: {
    id: string;
    title: string;
    description: string;
    type: string;
    address: string;
    city: string;
    neighborhood: string;
    pricePerNight: number;
    netoDeseadoUsd?: number | null;
    precioClienteCalculadoUsd?: number | null;
    cleaningFee: number;
    serviceFee: number;
    taxRate: number;
    capacity: number;
    beds: number;
    baths: number;
    cancelPolicy: string;
    instantBook: boolean;
    photos: Photo[];
  };
};

const money = (value: number) => `USD ${Number(value || 0).toFixed(2)}`;

export const HostListingEditor = ({ listing }: ListingEditorProps) => {
  const [csrf, setCsrf] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [icalUrl, setIcalUrl] = useState('');
  const [icalProvider, setIcalProvider] = useState('Airbnb');
  const [icalError, setIcalError] = useState('');
  const [icalBusy, setIcalBusy] = useState(false);
  const [feeds, setFeeds] = useState<IcalFeed[]>([]);
  const [hosteaIcalUrl, setHosteaIcalUrl] = useState('');
  const [bookingModeBusy, setBookingModeBusy] = useState(false);
  const [showIcalModeModal, setShowIcalModeModal] = useState(false);
  const [dynamicBusy, setDynamicBusy] = useState(false);
  const [dynamicError, setDynamicError] = useState('');
  const [dynamicOccupancyRate, setDynamicOccupancyRate] = useState(0);
  const [dynamicPreview, setDynamicPreview] = useState<DynamicPreview[]>([]);
  const [dynamicConfig, setDynamicConfig] = useState<DynamicPricingForm>({
    enabled: false,
    basePrice: Number(listing.pricePerNight) || 0,
    minPrice: Math.max(1, Number(listing.pricePerNight) * 0.7 || 1),
    maxPrice: Math.max(1, Number(listing.pricePerNight) * 1.6 || 1)
  });
  const [pricingParams, setPricingParams] = useState(defaultSmartPricingParams);
  const [photos, setPhotos] = useState<Photo[]>(listing.photos || []);
  const [form, setForm] = useState({
    title: listing.title,
    description: listing.description,
    type: listing.type,
    address: listing.address,
    city: listing.city,
    neighborhood: listing.neighborhood,
    netoDeseadoUsd:
      typeof listing.netoDeseadoUsd === 'number' ? listing.netoDeseadoUsd : Number(listing.pricePerNight),
    cleaningFee: listing.cleaningFee,
    taxRate: listing.taxRate,
    capacity: listing.capacity,
    beds: listing.beds,
    baths: listing.baths,
    cancelPolicy: listing.cancelPolicy,
    bookingMode: bookingModeFromInstantBook(listing.instantBook)
  });

  const loadIcalFeeds = async () => {
    const res = await fetch(`/api/host/listings/${listing.id}/ical-feeds`);
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setFeeds(data.feeds || []);
      setHosteaIcalUrl(data.hosteaIcalUrl || '');
    }
  };

  const loadDynamicPricing = async () => {
    const res = await fetch(`/api/host/listings/${listing.id}/dynamic-pricing`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setDynamicError(data?.error || 'No se pudo cargar pricing dinamico');
      return;
    }
    setDynamicConfig({
      enabled: Boolean(data?.config?.enabled),
      basePrice: Number(data?.config?.basePrice || Number(listing.pricePerNight) || 0),
      minPrice: Number(data?.config?.minPrice || 1),
      maxPrice: Number(data?.config?.maxPrice || Number(listing.pricePerNight) || 1)
    });
    setDynamicPreview(Array.isArray(data?.preview) ? data.preview : []);
    setDynamicOccupancyRate(Number(data?.occupancyRate || 0));
  };

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

    loadIcalFeeds();
    loadDynamicPricing();
  }, []);

  const calculatedPrice = useMemo(
    () => calcClientPriceFromHostNet(form.netoDeseadoUsd, pricingParams),
    [form.netoDeseadoUsd, pricingParams]
  );
  const breakdown = useMemo(
    () => calcBreakdown(calculatedPrice, pricingParams),
    [calculatedPrice, pricingParams]
  );

  const save = async () => {
    setSaving(true);
    const payload = {
      ...form,
      pricePerNight: calculatedPrice,
      netoDeseadoUsd: form.netoDeseadoUsd,
      precioClienteCalculadoUsd: calculatedPrice,
      bookingMode: form.bookingMode
    };
    await fetch(`/api/host/listings/${listing.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrf },
      body: JSON.stringify(payload)
    });
    setSaving(false);
    alert('Listing actualizado');
  };

  const saveBookingMode = async (mode: BookingMode) => {
    setBookingModeBusy(true);
    try {
      const res = await fetch(`/api/host/listings/${listing.id}/booking-mode`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrf },
        body: JSON.stringify({ mode })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setIcalError(data?.error || 'No se pudo actualizar el modo de reservas.');
        return;
      }
      setForm((prev) => ({ ...prev, bookingMode: mode }));
    } finally {
      setBookingModeBusy(false);
    }
  };

  const uploadFile = async (file: File) => {
    setUploadError('');
    const key = `listings/${listing.id}/${Date.now()}-${file.name}`;
    const signRes = await fetch('/api/uploads/presign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrf },
      body: JSON.stringify({ key })
    });
    const signed = await signRes.json();
    if (!signRes.ok || !signed.signedUrl) {
      setUploadError(signed?.error || 'No se pudo firmar la subida');
      return;
    }
    const putRes = await fetch(signed.signedUrl, {
      method: 'PUT',
      headers: { 'Content-Type': file.type },
      body: file
    });
    if (!putRes.ok) {
      setUploadError('No se pudo subir la imagen (PUT).');
      return;
    }
    const photoRes = await fetch(`/api/host/listings/${listing.id}/photos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrf },
      body: JSON.stringify({ url: signed.publicUrl })
    });
    const data = await photoRes.json();
    if (data.photo) {
      setPhotos((prev) => [...prev, data.photo]);
      return;
    }
    setUploadError(data?.error || 'No se pudo guardar la foto.');
  };

  const onFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    for (const file of Array.from(files)) {
      await uploadFile(file);
    }
    setUploading(false);
  };

  const removePhoto = async (photoId: string) => {
    await fetch(`/api/host/listings/${listing.id}/photos?photoId=${photoId}`, {
      method: 'DELETE',
      headers: { 'x-csrf-token': csrf }
    });
    setPhotos((prev) => prev.filter((p) => p.id !== photoId));
  };

  const setPrimary = async (photoId: string) => {
    await fetch(`/api/host/listings/${listing.id}/photos`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrf },
      body: JSON.stringify({ photoId })
    });
    setPhotos((prev) =>
      prev
        .map((p) => ({ ...p, sortOrder: p.id === photoId ? 0 : p.sortOrder + 1 }))
        .sort((a, b) => a.sortOrder - b.sortOrder)
    );
  };

  const addIcalFeed = async () => {
    if (!icalUrl.trim()) return;
    setIcalError('');
    setIcalBusy(true);
    const res = await fetch(`/api/host/listings/${listing.id}/ical-feeds`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrf },
      body: JSON.stringify({ url: icalUrl.trim(), provider: icalProvider.trim() || undefined })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setIcalError(data?.error || 'No se pudo guardar el iCal.');
      setIcalBusy(false);
      return;
    }
    setIcalUrl('');
    if (data?.recommendApprovalMode && form.bookingMode === 'instant') {
      setShowIcalModeModal(true);
    }
    await loadIcalFeeds();
    setIcalBusy(false);
  };

  const syncAllIcalFeeds = async () => {
    setIcalError('');
    setIcalBusy(true);
    const res = await fetch(`/api/host/listings/${listing.id}/ical-feeds/sync`, {
      method: 'POST',
      headers: { 'x-csrf-token': csrf }
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setIcalError(data?.error || 'No se pudo sincronizar.');
      setIcalBusy(false);
      return;
    }
    await loadIcalFeeds();
    setIcalBusy(false);
  };

  const syncFeed = async (feedId: string) => {
    setIcalError('');
    setIcalBusy(true);
    const res = await fetch(`/api/host/listings/${listing.id}/ical-feeds/${feedId}`, {
      method: 'POST',
      headers: { 'x-csrf-token': csrf }
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setIcalError(data?.error || 'No se pudo sincronizar el feed.');
      setIcalBusy(false);
      return;
    }
    await loadIcalFeeds();
    setIcalBusy(false);
  };

  const removeFeed = async (feedId: string) => {
    setIcalError('');
    setIcalBusy(true);
    const res = await fetch(`/api/host/listings/${listing.id}/ical-feeds/${feedId}`, {
      method: 'DELETE',
      headers: { 'x-csrf-token': csrf }
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setIcalError(data?.error || 'No se pudo eliminar el feed.');
      setIcalBusy(false);
      return;
    }
    await loadIcalFeeds();
    setIcalBusy(false);
  };

  const toggleFeed = async (feed: IcalFeed) => {
    setIcalError('');
    const res = await fetch(`/api/host/listings/${listing.id}/ical-feeds/${feed.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrf },
      body: JSON.stringify({ isActive: !feed.isActive })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setIcalError(data?.error || 'No se pudo actualizar el feed.');
      return;
    }
    if (!feed.isActive && form.bookingMode === 'instant') {
      setShowIcalModeModal(true);
    }
    await loadIcalFeeds();
  };

  const copyHosteaIcal = async () => {
    if (!hosteaIcalUrl) return;
    try {
      await navigator.clipboard.writeText(hosteaIcalUrl);
      alert('URL iCal de Hostea copiada.');
    } catch {
      alert('No se pudo copiar automaticamente. Copia manualmente.');
    }
  };

  const saveDynamicPricing = async () => {
    setDynamicError('');
    setDynamicBusy(true);
    const payload = {
      enabled: dynamicConfig.enabled,
      basePrice: Math.max(1, Number(dynamicConfig.basePrice) || 1),
      minPrice: Math.max(1, Number(dynamicConfig.minPrice) || 1),
      maxPrice: Math.max(1, Number(dynamicConfig.maxPrice) || 1)
    };
    const res = await fetch(`/api/host/listings/${listing.id}/dynamic-pricing`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrf },
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setDynamicError(data?.error || 'No se pudo guardar pricing dinamico');
      setDynamicBusy(false);
      return;
    }
    await loadDynamicPricing();
    setDynamicBusy(false);
  };

  return (
    <div className="space-y-8">
      <div className="surface-card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Datos principales</h2>
            <p className="text-sm text-slate-500">Edita la informacion y precios.</p>
          </div>
          <Button size="sm" onClick={save} disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </Button>
        </div>
        <div className="mt-6 grid gap-3 md:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Titulo</p>
            <Input
              placeholder="Titulo"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Descripcion</p>
            <Input
              placeholder="Descripcion"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Direccion</p>
            <Input
              placeholder="Direccion"
              value={form.address}
              onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
            />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Ciudad</p>
            <Input
              placeholder="Ciudad"
              value={form.city}
              onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
            />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Barrio</p>
            <Input
              placeholder="Barrio"
              value={form.neighborhood}
              onChange={(e) => setForm((f) => ({ ...f, neighborhood: e.target.value }))}
            />
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
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Limpieza (USD)</p>
            <Input
              type="number"
              placeholder="Limpieza"
              value={form.cleaningFee}
              onChange={(e) => setForm((f) => ({ ...f, cleaningFee: Number(e.target.value) }))}
            />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Impuestos (%)</p>
            <Input
              type="number"
              step="0.1"
              placeholder="Ej: 10"
              value={Math.round(form.taxRate * 100 * 100) / 100}
              onChange={(e) => setForm((f) => ({ ...f, taxRate: Number(e.target.value) / 100 }))}
            />
            <p className="mt-1 text-[11px] text-slate-500">Se calcula sobre el subtotal.</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Capacidad</p>
            <Input
              type="number"
              placeholder="Capacidad"
              value={form.capacity}
              onChange={(e) => setForm((f) => ({ ...f, capacity: Number(e.target.value) }))}
            />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Camas</p>
            <Input
              type="number"
              placeholder="Camas"
              value={form.beds}
              onChange={(e) => setForm((f) => ({ ...f, beds: Number(e.target.value) }))}
            />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Banos</p>
            <Input
              type="number"
              placeholder="Banos"
              value={form.baths}
              onChange={(e) => setForm((f) => ({ ...f, baths: Number(e.target.value) }))}
            />
          </div>
          <select
            className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-xs font-semibold uppercase tracking-wide"
            value={form.type}
            onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
          >
            <option value="APARTMENT">APARTMENT</option>
            <option value="HOTEL">HOTEL</option>
          </select>
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
                    onClick={() => setForm((prev) => ({ ...prev, bookingMode: mode }))}
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
        </div>
        <div className="mt-6 rounded-2xl border border-slate-200/70 bg-white p-4">
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

      <div className="surface-card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Pricing dinamico</h2>
            <p className="text-sm text-slate-500">
              Ajusta precio automaticamente por ocupacion, cercania y dia de la semana.
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={saveDynamicPricing} disabled={dynamicBusy}>
            {dynamicBusy ? 'Guardando...' : 'Guardar pricing dinamico'}
          </Button>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <label className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={dynamicConfig.enabled}
              onChange={(e) =>
                setDynamicConfig((prev) => ({ ...prev, enabled: e.target.checked }))
              }
            />
            Activar
          </label>
          <div className="space-y-1">
            <label
              htmlFor="dynamic-base-price"
              className="text-xs font-semibold uppercase tracking-wide text-slate-500"
            >
              Precio base (USD)
            </label>
            <Input
              id="dynamic-base-price"
              type="number"
              min={1}
              step="0.01"
              placeholder="40"
              value={dynamicConfig.basePrice}
              onChange={(e) =>
                setDynamicConfig((prev) => ({ ...prev, basePrice: Number(e.target.value) || 0 }))
              }
            />
            <p className="text-[11px] text-slate-500">Precio normal por noche.</p>
          </div>
          <div className="space-y-1">
            <label
              htmlFor="dynamic-min-price"
              className="text-xs font-semibold uppercase tracking-wide text-slate-500"
            >
              Precio minimo (USD)
            </label>
            <Input
              id="dynamic-min-price"
              type="number"
              min={1}
              step="0.01"
              placeholder="28"
              value={dynamicConfig.minPrice}
              onChange={(e) =>
                setDynamicConfig((prev) => ({ ...prev, minPrice: Number(e.target.value) || 0 }))
              }
            />
            <p className="text-[11px] text-slate-500">Limite inferior automatico.</p>
          </div>
          <div className="space-y-1">
            <label
              htmlFor="dynamic-max-price"
              className="text-xs font-semibold uppercase tracking-wide text-slate-500"
            >
              Precio maximo (USD)
            </label>
            <Input
              id="dynamic-max-price"
              type="number"
              min={1}
              step="0.01"
              placeholder="64"
              value={dynamicConfig.maxPrice}
              onChange={(e) =>
                setDynamicConfig((prev) => ({ ...prev, maxPrice: Number(e.target.value) || 0 }))
              }
            />
            <p className="text-[11px] text-slate-500">Limite superior automatico.</p>
          </div>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Recomendado: minimo entre -20% y -30% del base, maximo entre +30% y +60%.
        </p>
        {dynamicError && <p className="mt-3 text-sm text-red-600">{dynamicError}</p>}
        <div className="mt-4 rounded-2xl border border-slate-200/70 bg-white p-4 text-sm text-slate-600">
          <p className="font-semibold text-slate-900">Desglose del calculo</p>
          <p className="mt-1">
            Ocupacion actual (60 dias): {(dynamicOccupancyRate * 100).toFixed(1)}%
          </p>
          <p className="text-xs text-slate-500">
            Formula: base * (1 + ajuste ocupacion + ajuste cercania + ajuste dia) con limite min/max.
          </p>
        </div>
        <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200/70 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2">Fecha</th>
                <th className="px-3 py-2">Base</th>
                <th className="px-3 py-2">Ocupacion</th>
                <th className="px-3 py-2">Cercania</th>
                <th className="px-3 py-2">Dia semana</th>
                <th className="px-3 py-2">Final</th>
              </tr>
            </thead>
            <tbody>
              {dynamicPreview.map((row) => (
                <tr key={row.date} className="border-t border-slate-100 text-slate-700">
                  <td className="px-3 py-2">{row.date}</td>
                  <td className="px-3 py-2">{money(row.basePrice)}</td>
                  <td className="px-3 py-2">{(row.occupancyAdjustmentPct * 100).toFixed(1)}%</td>
                  <td className="px-3 py-2">{(row.leadTimeAdjustmentPct * 100).toFixed(1)}%</td>
                  <td className="px-3 py-2">{(row.dayOfWeekAdjustmentPct * 100).toFixed(1)}%</td>
                  <td className="px-3 py-2 font-semibold text-slate-900">{money(row.finalPrice)}</td>
                </tr>
              ))}
              {dynamicPreview.length === 0 && (
                <tr>
                  <td className="px-3 py-3 text-slate-500" colSpan={6}>
                    Activa pricing dinamico para ver el desglose por noche.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="surface-card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Sincronizacion iCal</h2>
            <p className="text-sm text-slate-500">
              Agrega links de Airbnb, Booking o Expedia para bloquear fechas automaticamente.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={syncAllIcalFeeds} disabled={icalBusy}>
            {icalBusy ? 'Sincronizando...' : 'Sincronizar'}
          </Button>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-[180px_1fr_auto]">
          <Input
            placeholder="Proveedor"
            value={icalProvider}
            onChange={(e) => setIcalProvider(e.target.value)}
          />
          <Input
            placeholder="https://..."
            value={icalUrl}
            onChange={(e) => setIcalUrl(e.target.value)}
          />
          <Button size="sm" onClick={addIcalFeed} disabled={icalBusy}>
            Agregar link iCal
          </Button>
        </div>

        {feeds.length > 0 && form.bookingMode === 'instant' && (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <p className="font-semibold">Sincronizacion iCal (importante)</p>
            <p className="mt-1 text-xs text-amber-800">
              iCal puede demorar en actualizarse. Para reducir overbooking, recomendamos activar
              "Reservas por aprobacion".
            </p>
            <div className="mt-3">
              <Button
                size="sm"
                variant="outline"
                onClick={() => saveBookingMode('approval')}
                disabled={bookingModeBusy}
              >
                {bookingModeBusy ? 'Actualizando...' : 'Activar Reservas por aprobacion'}
              </Button>
            </div>
          </div>
        )}

        <div className="mt-4 rounded-2xl border border-slate-200/70 bg-white p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">iCal de Hostea</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Input value={hosteaIcalUrl} readOnly className="flex-1 min-w-[260px]" />
            <Button size="sm" variant="outline" onClick={copyHosteaIcal}>
              Copiar
            </Button>
          </div>
        </div>

        <p className="mt-4 text-xs text-amber-700">
          Las sincronizaciones por iCal no son instantaneas y pueden tardar hasta 2 horas.
        </p>
        {icalError && <p className="mt-2 text-sm text-red-600">{icalError}</p>}

        <div className="mt-4 space-y-2">
          {feeds.map((feed) => (
            <div key={feed.id} className="surface-muted flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-slate-900">{feed.provider || 'iCal'}</p>
                <p className="break-all text-xs text-slate-500">{feed.url}</p>
                <p className="text-xs text-slate-500">
                  Estado:{' '}
                  {feed.lastSyncStatus === 'SYNCED'
                    ? 'sincronizado'
                    : feed.lastSyncStatus === 'ERROR'
                      ? 'error'
                      : 'pendiente'}
                  {feed.lastSyncAt ? ` - ${feed.lastSyncAt.slice(0, 19).replace('T', ' ')}` : ''}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => toggleFeed(feed)}>
                  {feed.isActive ? 'Desactivar' : 'Activar'}
                </Button>
                <Button size="sm" variant="outline" onClick={() => syncFeed(feed.id)} disabled={icalBusy}>
                  Sincronizar
                </Button>
                <Button size="sm" variant="outline" onClick={() => removeFeed(feed.id)} disabled={icalBusy}>
                  Eliminar
                </Button>
              </div>
            </div>
          ))}
          {feeds.length === 0 && (
            <p className="text-sm text-slate-500">Aun no agregaste enlaces iCal para esta propiedad.</p>
          )}
        </div>
      </div>

      <div className="surface-card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Fotos</h2>
            <p className="text-sm text-slate-500">Subi imagenes reales del alojamiento.</p>
          </div>
          <label className="pill-link cursor-pointer">
            {uploading ? 'Subiendo...' : 'Agregar fotos'}
            <input type="file" className="hidden" accept="image/*" multiple onChange={(e) => onFiles(e.target.files)} />
          </label>
        </div>
        {uploadError && <p className="mt-3 text-sm text-red-600">{uploadError}</p>}
        <div className="mt-6 grid gap-3 md:grid-cols-3">
          {photos.map((photo) => (
            <div key={photo.id} className="rounded-2xl border border-slate-200/70 bg-white p-2">
              <div className="aspect-[4/3] overflow-hidden rounded-xl bg-slate-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo.url} alt="Foto" className="h-full w-full object-cover" />
              </div>
              <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                <button onClick={() => setPrimary(photo.id)} className="font-semibold text-slate-700">
                  Principal
                </button>
                <button onClick={() => removePhoto(photo.id)} className="text-red-600">
                  Eliminar
                </button>
              </div>
            </div>
          ))}
          {photos.length === 0 && <p className="text-sm text-slate-500">Aun no hay fotos cargadas.</p>}
        </div>
      </div>

      {showIcalModeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl">
            <h3 className="text-xl font-semibold text-slate-900">Sincronizacion iCal (importante)</h3>
            <p className="mt-3 text-sm text-slate-600">
              Estas usando sincronizacion por iCal con canales externos (Airbnb/Booking/etc).
              iCal puede demorar en actualizarse, por lo que algunas reservas externas podrian no
              reflejarse al instante en Hostea. Para reducir overbooking, recomendamos activar
              "Reservas por aprobacion".
            </p>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <Button variant="outline" onClick={() => setShowIcalModeModal(false)}>
                Entendido
              </Button>
              <Button
                onClick={async () => {
                  await saveBookingMode('approval');
                  setShowIcalModeModal(false);
                }}
                disabled={bookingModeBusy}
              >
                {bookingModeBusy ? 'Actualizando...' : 'Activar Reservas por aprobacion'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
