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

type Photo = { id: string; url: string; sortOrder: number };

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
    instantBook: listing.instantBook
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
      precioClienteCalculadoUsd: calculatedPrice
    };
    await fetch(`/api/host/listings/${listing.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrf },
      body: JSON.stringify(payload)
    });
    setSaving(false);
    alert('Listing actualizado');
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
          <label className="flex items-center gap-3 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={form.instantBook}
              onChange={(e) => setForm((f) => ({ ...f, instantBook: e.target.checked }))}
            />
            Reserva inmediata
          </label>
        </div>
        <div className="mt-6 rounded-2xl border border-slate-200/70 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-semibold text-slate-900">Precio inteligente (estimado)</p>
            <div className="text-xs text-slate-500">
              Stripe {(pricingParams.stripePct * 100).toFixed(2)}% + {money(pricingParams.stripeFixed)} ·
              Hostea {(pricingParams.platformPct * 100).toFixed(2)}%
            </div>
          </div>
          <div className="mt-3 space-y-1 text-sm text-slate-600">
            <div className="flex items-center justify-between">
              <span>Precio al cliente</span>
              <span>{money(calculatedPrice)}</span>
            </div>
            <div className="flex items-center justify-between text-slate-500">
              <span>Estimacion fee Stripe</span>
              <span>-{money(breakdown.stripeFee)}</span>
            </div>
            <div className="flex items-center justify-between text-slate-500">
              <span>Fee Hostea</span>
              <span>-{money(breakdown.platformFee)}</span>
            </div>
            <div className="flex items-center justify-between font-semibold text-slate-900">
              <span>Neto host</span>
              <span>{money(breakdown.hostNet)}</span>
            </div>
          </div>
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
    </div>
  );
};
