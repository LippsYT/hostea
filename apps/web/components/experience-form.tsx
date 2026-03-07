'use client';

import { useMemo, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  calcBreakdown,
  defaultSmartPricingParams,
  withSmartPricingParams
} from '@/lib/intelligent-pricing';

const categories = [
  'Tours',
  'Gastronomia',
  'Cultura',
  'Naturaleza',
  'Deportes',
  'Clases',
  'Excursiones'
];

type LocalPhoto = {
  id: string;
  url: string;
  isCover: boolean;
  sortOrder: number;
};

const uid = () => Math.random().toString(36).slice(2, 10);

export function ExperienceForm() {
  const router = useRouter();
  const [csrf, setCsrf] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [scheduleInput, setScheduleInput] = useState('');
  const [pricingParams, setPricingParams] = useState(defaultSmartPricingParams);

  const [form, setForm] = useState({
    title: '',
    description: '',
    category: 'Tours',
    city: '',
    meetingPoint: '',
    durationMinutes: 120,
    language: 'Espanol',
    pricePerPerson: 25,
    childPrice: 18,
    infantPrice: 0,
    capacity: 8,
    activityType: 'SHARED',
    includesText: '',
    excludesText: '',
    requirementsText: ''
  });
  const [schedules, setSchedules] = useState<string[]>([]);
  const [photos, setPhotos] = useState<LocalPhoto[]>([]);

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

  const sortedPhotos = useMemo(
    () => [...photos].sort((a, b) => a.sortOrder - b.sortOrder),
    [photos]
  );
  const adultBreakdown = useMemo(
    () => calcBreakdown(form.pricePerPerson, pricingParams),
    [form.pricePerPerson, pricingParams]
  );
  const childBreakdown = useMemo(
    () => calcBreakdown(form.childPrice, pricingParams),
    [form.childPrice, pricingParams]
  );
  const infantBreakdown = useMemo(
    () => calcBreakdown(form.infantPrice, pricingParams),
    [form.infantPrice, pricingParams]
  );

  const addSchedule = () => {
    const value = scheduleInput.trim();
    if (!value) return;
    if (schedules.includes(value)) return;
    setSchedules((prev) => [...prev, value]);
    setScheduleInput('');
  };

  const removeSchedule = (value: string) => {
    setSchedules((prev) => prev.filter((item) => item !== value));
  };

  const setCover = (photoId: string) => {
    setPhotos((prev) =>
      prev.map((photo) => ({
        ...photo,
        isCover: photo.id === photoId
      }))
    );
  };

  const movePhoto = (photoId: string, direction: -1 | 1) => {
    const current = sortedPhotos;
    const index = current.findIndex((photo) => photo.id === photoId);
    if (index === -1) return;
    const target = index + direction;
    if (target < 0 || target >= current.length) return;

    const copy = [...current];
    [copy[index], copy[target]] = [copy[target], copy[index]];
    setPhotos(
      copy.map((photo, idx) => ({
        ...photo,
        sortOrder: idx
      }))
    );
  };

  const removePhoto = (photoId: string) => {
    const next = sortedPhotos.filter((photo) => photo.id !== photoId);
    const hasCover = next.some((photo) => photo.isCover);
    setPhotos(
      next.map((photo, idx) => ({
        ...photo,
        sortOrder: idx,
        isCover: hasCover ? photo.isCover : idx === 0
      }))
    );
  };

  const uploadFile = async (file: File) => {
    const key = `experiences/${Date.now()}-${file.name}`;
    const signRes = await fetch('/api/uploads/presign', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': csrf
      },
      body: JSON.stringify({ key })
    });
    const signed = await signRes.json();
    if (!signRes.ok || !signed.signedUrl) {
      throw new Error(signed?.error || 'No se pudo firmar la subida');
    }

    const putRes = await fetch(signed.signedUrl, {
      method: 'PUT',
      headers: { 'Content-Type': file.type || 'application/octet-stream' },
      body: file
    });
    if (!putRes.ok) {
      throw new Error('No se pudo subir la imagen');
    }

    setPhotos((prev) => {
      const nextOrder = prev.length;
      const newPhoto: LocalPhoto = {
        id: uid(),
        url: signed.publicUrl,
        sortOrder: nextOrder,
        isCover: prev.length === 0
      };
      return [...prev, newPhoto];
    });
  };

  const onSelectFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    setError('');
    try {
      for (const file of Array.from(files)) {
        await uploadFile(file);
      }
    } catch (uploadError: any) {
      setError(uploadError?.message || 'No se pudieron subir las fotos');
    } finally {
      setUploading(false);
    }
  };

  const onSubmit = async () => {
    setSaving(true);
    setMessage('');
    setError('');

    if (schedules.length === 0) {
      setSaving(false);
      setError('Agrega al menos un horario disponible.');
      return;
    }

    const payload = {
      ...form,
      schedules,
      photos: sortedPhotos.map((photo, idx) => ({
        url: photo.url,
        isCover: photo.isCover,
        sortOrder: idx
      }))
    };

    try {
      const res = await fetch('/api/host/experiences', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrf
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || 'No se pudo publicar la experiencia.');
        setSaving(false);
        return;
      }
      setMessage('Experiencia publicada correctamente.');
      router.push('/dashboard/host/explore/activities?created=1');
      router.refresh();
    } catch (submitError: any) {
      setError(submitError?.message || 'Ocurrio un error al guardar.');
      setSaving(false);
    }
  };

  return (
    <div className="surface-card space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Publicar experiencia</h2>
          <p className="text-sm text-slate-500">
            Completa la informacion para mostrarla en el marketplace de Explorar.
          </p>
        </div>
        <Button onClick={onSubmit} disabled={saving || uploading}>
          {saving ? 'Guardando...' : 'Publicar mi experiencia'}
        </Button>
      </div>

      {message && <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</p>}
      {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Titulo</p>
          <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Titulo de la actividad" />
        </div>
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Categoria</p>
          <select
            className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm"
            value={form.category}
            onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
          >
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </div>
        <div className="md:col-span-2">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Descripcion</p>
          <textarea
            className="min-h-[120px] w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            placeholder="Describe que incluye la experiencia, a quien esta dirigida y que la hace especial."
          />
        </div>
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Ciudad</p>
          <Input value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} placeholder="Ciudad o ubicacion" />
        </div>
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Punto de encuentro</p>
          <Input
            value={form.meetingPoint}
            onChange={(e) => setForm((f) => ({ ...f, meetingPoint: e.target.value }))}
            placeholder="Direccion o referencia para encontrarse"
          />
        </div>
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Duracion (minutos)</p>
          <Input
            type="number"
            min={30}
            value={form.durationMinutes}
            onChange={(e) => setForm((f) => ({ ...f, durationMinutes: Number(e.target.value) }))}
            placeholder="120"
          />
        </div>
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Idioma</p>
          <Input value={form.language} onChange={(e) => setForm((f) => ({ ...f, language: e.target.value }))} placeholder="Espanol / Ingles" />
        </div>
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Precio por persona (USD)</p>
          <Input
            type="number"
            min={1}
            step="0.01"
            value={form.pricePerPerson}
            onChange={(e) => setForm((f) => ({ ...f, pricePerPerson: Number(e.target.value) }))}
            placeholder="25"
          />
        </div>
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Precio nino (USD)</p>
          <Input
            type="number"
            min={0}
            step="0.01"
            value={form.childPrice}
            onChange={(e) => setForm((f) => ({ ...f, childPrice: Number(e.target.value) }))}
            placeholder="18"
          />
        </div>
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Precio infante (USD)</p>
          <Input
            type="number"
            min={0}
            step="0.01"
            value={form.infantPrice}
            onChange={(e) => setForm((f) => ({ ...f, infantPrice: Number(e.target.value) }))}
            placeholder="0"
          />
        </div>
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Capacidad por salida</p>
          <Input
            type="number"
            min={1}
            value={form.capacity}
            onChange={(e) => setForm((f) => ({ ...f, capacity: Number(e.target.value) }))}
            placeholder="8"
          />
        </div>
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Tipo de actividad</p>
          <select
            className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm"
            value={form.activityType}
            onChange={(e) => setForm((f) => ({ ...f, activityType: e.target.value }))}
          >
            <option value="SHARED">Actividad compartida</option>
            <option value="PRIVATE">Actividad privada</option>
          </select>
        </div>
        <div className="md:col-span-2">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Que incluye la actividad
          </p>
          <textarea
            className="min-h-[90px] w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm"
            value={form.includesText}
            onChange={(e) => setForm((f) => ({ ...f, includesText: e.target.value }))}
            placeholder="Incluye transporte, guia local, snacks..."
          />
        </div>
        <div className="md:col-span-2">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Que no incluye
          </p>
          <textarea
            className="min-h-[90px] w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm"
            value={form.excludesText}
            onChange={(e) => setForm((f) => ({ ...f, excludesText: e.target.value }))}
            placeholder="Comidas, entradas a museos, propinas..."
          />
        </div>
        <div className="md:col-span-2">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Requisitos o informacion importante
          </p>
          <textarea
            className="min-h-[90px] w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm"
            value={form.requirementsText}
            onChange={(e) => setForm((f) => ({ ...f, requirementsText: e.target.value }))}
            placeholder="Ropa comoda, documento, puntualidad, recomendaciones..."
          />
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <p className="text-sm font-semibold text-slate-900">Resumen de comisiones (USD)</p>
        <p className="mt-1 text-xs text-slate-500">
          Vista para que el anfitrion entienda lo que paga y lo que recibe por pasajero.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {[
            { label: 'Adulto', price: form.pricePerPerson, breakdown: adultBreakdown },
            { label: 'Nino', price: form.childPrice, breakdown: childBreakdown },
            { label: 'Infante', price: form.infantPrice, breakdown: infantBreakdown }
          ].map((item) => (
            <div key={item.label} className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-xs">
              <p className="font-semibold text-slate-900">{item.label}</p>
              <div className="mt-2 space-y-1 text-slate-600">
                <div className="flex items-center justify-between">
                  <span>Precio al cliente</span>
                  <span>USD {Number(item.price || 0).toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Cargos administrativos</span>
                  <span>-USD {item.breakdown.stripeFee.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Tarifa de servicio</span>
                  <span>-USD {item.breakdown.platformFee.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between font-semibold text-slate-900">
                  <span>Neto anfitrion</span>
                  <span>USD {item.breakdown.hostNet.toFixed(2)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <p className="text-sm font-semibold text-slate-900">Horarios disponibles</p>
        <p className="mt-1 text-xs text-slate-500">
          Ejemplo: Lun a Vie 10:00, Sab 16:30 o salidas especiales por temporada.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Input
            value={scheduleInput}
            onChange={(e) => setScheduleInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addSchedule();
              }
            }}
            placeholder="Agregar horario"
            className="max-w-sm"
          />
          <Button variant="outline" onClick={addSchedule}>
            Agregar horario
          </Button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {schedules.map((slot) => (
            <button
              key={slot}
              onClick={() => removeSchedule(slot)}
              className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-700 hover:bg-slate-100"
            >
              {slot} x
            </button>
          ))}
          {schedules.length === 0 && <p className="text-xs text-slate-500">Aun no agregaste horarios.</p>}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-900">Fotos</p>
            <p className="text-xs text-slate-500">
              Sube imagenes, elige portada y ordena como se mostraran en /explorar.
            </p>
          </div>
          <label className="pill-link cursor-pointer">
            {uploading ? 'Subiendo...' : 'Subir fotos'}
            <input
              type="file"
              className="hidden"
              accept="image/*"
              multiple
              onChange={(e) => onSelectFiles(e.target.files)}
              disabled={uploading}
            />
          </label>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sortedPhotos.map((photo, index) => (
            <div key={photo.id} className="rounded-2xl border border-slate-200 p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo.url} alt="Foto experiencia" className="aspect-[4/3] w-full rounded-xl object-cover" />
              <div className="mt-2 flex items-center justify-between gap-2 text-xs">
                <button
                  onClick={() => setCover(photo.id)}
                  className={photo.isCover ? 'font-semibold text-emerald-600' : 'text-slate-600'}
                >
                  {photo.isCover ? 'Portada' : 'Definir portada'}
                </button>
                <div className="flex items-center gap-2">
                  <button onClick={() => movePhoto(photo.id, -1)} disabled={index === 0} className="text-slate-600 disabled:opacity-40">
                    Arriba
                  </button>
                  <button
                    onClick={() => movePhoto(photo.id, 1)}
                    disabled={index === sortedPhotos.length - 1}
                    className="text-slate-600 disabled:opacity-40"
                  >
                    Abajo
                  </button>
                  <button onClick={() => removePhoto(photo.id)} className="text-red-600">
                    Eliminar
                  </button>
                </div>
              </div>
            </div>
          ))}
          {sortedPhotos.length === 0 && <p className="text-sm text-slate-500">Aun no hay fotos cargadas.</p>}
        </div>
      </div>
    </div>
  );
}
