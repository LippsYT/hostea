'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export const HostListingForm = () => {
  const [csrf, setCsrf] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [saving, setSaving] = useState(false);
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
        <Input placeholder="Titulo" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
        <Input placeholder="Descripcion" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
        <Input placeholder="Direccion" value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
        <Input placeholder="Ciudad" value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} />
        <Input placeholder="Barrio" value={form.neighborhood} onChange={(e) => setForm((f) => ({ ...f, neighborhood: e.target.value }))} />
        <Input type="number" placeholder="Precio por noche" value={form.pricePerNight} onChange={(e) => setForm((f) => ({ ...f, pricePerNight: Number(e.target.value) }))} />
        <Input type="number" placeholder="Capacidad" value={form.capacity} onChange={(e) => setForm((f) => ({ ...f, capacity: Number(e.target.value) }))} />
        <Input type="number" placeholder="Camas" value={form.beds} onChange={(e) => setForm((f) => ({ ...f, beds: Number(e.target.value) }))} />
        <Input type="number" placeholder="Banos" value={form.baths} onChange={(e) => setForm((f) => ({ ...f, baths: Number(e.target.value) }))} />
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
    </div>
  );
};
