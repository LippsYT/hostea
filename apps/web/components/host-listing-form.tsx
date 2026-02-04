'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export const HostListingForm = () => {
  const [csrf, setCsrf] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [saving, setSaving] = useState(false);
  const [hostFeePercent, setHostFeePercent] = useState(0.15);
  const [form, setForm] = useState({
    title: '',
    description: '',
    type: 'APARTMENT',
    address: '',
    city: '',
    neighborhood: '',
    pricePerNight: 70,
    capacity: 2,
    beds: 1,
    baths: 1,
    cancelPolicy: 'FLEXIBLE'
  });

  useEffect(() => {
    fetch('/api/security/csrf').then(async (res) => {
      const data = await res.json();
      setCsrf(data.token);
    });
  }, []);

  const hostFee = Math.round(form.pricePerNight * hostFeePercent * 100) / 100;
  const hostEarnings = Math.round((form.pricePerNight - hostFee) * 100) / 100;

  const onSubmit = async () => {
    setErrorMsg('');
    setSaving(true);
    const res = await fetch('/api/host/listings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': csrf
      },
      body: JSON.stringify(form)
    });
    const data = await res.json();
    if (!res.ok) {
      const issues = Array.isArray(data?.issues) ? ` (${data.issues.map((i: any) => i.path?.join('.') || 'campo').join(', ')})` : '';
      setErrorMsg((data?.error || 'No se pudo crear el listing.') + issues);
      setSaving(false);
      return;
    }
    if (data.listing?.id) {
      window.location.href = `/dashboard/host/listings/${data.listing.id}`;
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
          <Input placeholder="Ej: Loft moderno en Palermo" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Descripcion</p>
          <Input placeholder="Breve descripcion del espacio" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Direccion</p>
          <Input placeholder="Calle y numero" value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Ciudad</p>
          <Input placeholder="Ciudad" value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Barrio</p>
          <Input placeholder="Barrio / Zona" value={form.neighborhood} onChange={(e) => setForm((f) => ({ ...f, neighborhood: e.target.value }))} />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Precio por noche (USD)</p>
          <Input type="number" placeholder="70" value={form.pricePerNight} onChange={(e) => setForm((f) => ({ ...f, pricePerNight: Number(e.target.value) }))} />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Capacidad (huéspedes)</p>
          <Input type="number" placeholder="2" value={form.capacity} onChange={(e) => setForm((f) => ({ ...f, capacity: Number(e.target.value) }))} />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Camas</p>
          <Input type="number" placeholder="1" value={form.beds} onChange={(e) => setForm((f) => ({ ...f, beds: Number(e.target.value) }))} />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Baños</p>
          <Input type="number" placeholder="1" value={form.baths} onChange={(e) => setForm((f) => ({ ...f, baths: Number(e.target.value) }))} />
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
      </div>
      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-semibold text-slate-900">Posibles ganancias</p>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>Fee host (%)</span>
            <input
              type="number"
              className="h-8 w-16 rounded-xl border border-slate-200 px-2 text-right text-xs"
              value={Math.round(hostFeePercent * 100)}
              onChange={(e) => setHostFeePercent(Math.max(0, Math.min(0.3, Number(e.target.value) / 100)))}
            />
          </div>
        </div>
        <div className="mt-3 space-y-1 text-sm text-slate-600">
          <div className="flex items-center justify-between">
            <span>1 noche por USD {form.pricePerNight || 0}</span>
            <span>USD {form.pricePerNight || 0}</span>
          </div>
          <div className="flex items-center justify-between text-slate-500">
            <span>Tarifa de servicio (anfitrion)</span>
            <span>-USD {hostFee.toFixed(2)}</span>
          </div>
          <div className="flex items-center justify-between font-semibold text-slate-900">
            <span>Total (USD)</span>
            <span>USD {hostEarnings.toFixed(2)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
