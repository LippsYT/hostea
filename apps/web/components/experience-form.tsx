'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  calcBreakdown,
  defaultSmartPricingParams,
  withSmartPricingParams
} from '@/lib/intelligent-pricing';
import {
  getFallbackCitiesByCountry,
  getFallbackCountries
} from '@/lib/location-presets';
import { fetchCityOptions, fetchCountryOptions } from '@/lib/location-options';

const categories = [
  'Tours',
  'Gastronomia',
  'Traslados',
  'Navegacion',
  'Aventura',
  'Bienestar',
  'Entradas',
  'Clases y talleres',
  'Eventos privados',
  'Shows'
];

type LocalPhoto = {
  id: string;
  url: string;
  isCover: boolean;
  sortOrder: number;
};

const uid = () => Math.random().toString(36).slice(2, 10);

type ExperienceFormInitialData = {
  title: string;
  description: string;
  category: string;
  country: string;
  region: string;
  city: string;
  zone: string;
  exactAddress: string;
  meetingPoint: string;
  coverageType: string;
  serviceRadiusKm: number;
  coveredZones: string;
  durationMinutes: number;
  language: string;
  pricePerPerson: number;
  childPrice: number;
  infantPrice: number;
  capacity: number;
  minimumAge: number;
  infantMaxAge: number;
  childMaxAge: number;
  adultMinAge: number;
  bookingMode: string;
  activityType: string;
  includesText?: string | null;
  excludesText?: string | null;
  requirementsText?: string | null;
  schedules: string[];
  photos: LocalPhoto[];
};

type ExperienceFormProps = {
  mode?: 'create' | 'edit';
  experienceId?: string;
  initialData?: ExperienceFormInitialData;
};

export function ExperienceForm({
  mode = 'create',
  experienceId,
  initialData
}: ExperienceFormProps) {
  const router = useRouter();
  const isEdit = mode === 'edit' && Boolean(experienceId);
  const fallbackCountries = getFallbackCountries();
  const initialCountry = initialData?.country || fallbackCountries[0] || 'Argentina';
  const initialCities = getFallbackCitiesByCountry(initialCountry);
  const [countries, setCountries] = useState<string[]>(fallbackCountries);
  const [cities, setCities] = useState<string[]>(
    initialCities.length ? initialCities : initialData?.city ? [initialData.city] : []
  );
  const [loadingCities, setLoadingCities] = useState(false);
  const [csrf, setCsrf] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [scheduleInput, setScheduleInput] = useState('');
  const [pricingParams, setPricingParams] = useState(defaultSmartPricingParams);

  const [form, setForm] = useState(() => ({
    title: initialData?.title ?? '',
    description: initialData?.description ?? '',
    category: initialData?.category ?? 'Tours',
    country: initialCountry,
    region: initialData?.region ?? '',
    city: initialData?.city ?? initialCities[0] ?? '',
    zone: initialData?.zone ?? '',
    exactAddress: initialData?.exactAddress ?? '',
    meetingPoint: initialData?.meetingPoint ?? '',
    coverageType: initialData?.coverageType ?? 'FIXED',
    serviceRadiusKm: initialData?.serviceRadiusKm ?? 0,
    coveredZones: initialData?.coveredZones ?? '',
    durationMinutes: initialData?.durationMinutes ?? 120,
    language: initialData?.language ?? 'Espanol',
    pricePerPerson: initialData?.pricePerPerson ?? 25,
    childPrice: initialData?.childPrice ?? 18,
    infantPrice: initialData?.infantPrice ?? 0,
    capacity: initialData?.capacity ?? 8,
    minimumAge: initialData?.minimumAge ?? 0,
    infantMaxAge: initialData?.infantMaxAge ?? 2,
    childMaxAge: initialData?.childMaxAge ?? 12,
    adultMinAge: initialData?.adultMinAge ?? 13,
    bookingMode: initialData?.bookingMode ?? 'INSTANT',
    activityType: initialData?.activityType ?? 'SHARED',
    includesText: initialData?.includesText ?? '',
    excludesText: initialData?.excludesText ?? '',
    requirementsText: initialData?.requirementsText ?? ''
  }));
  const [schedules, setSchedules] = useState<string[]>(initialData?.schedules ?? []);
  const [photos, setPhotos] = useState<LocalPhoto[]>(initialData?.photos ?? []);

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
        const hostCommissionPct = Number(
          data?.settings?.hostCommissionPercent ?? data?.settings?.commissionPercent
        );
        const guestServicePct = Number(data?.settings?.guestServicePercent);
        const processingPct = Number(data?.settings?.processingPercent);
        const processingFixed = Number(data?.settings?.processingFixed);
        setPricingParams((current) =>
          withSmartPricingParams({
            stripePct: Number.isFinite(processingPct) ? processingPct : current.stripePct,
            stripeFixed: Number.isFinite(processingFixed) ? processingFixed : current.stripeFixed,
            platformPct: Number.isFinite(hostCommissionPct)
              ? hostCommissionPct
              : current.platformPct,
            guestPct: Number.isFinite(guestServicePct) ? guestServicePct : current.guestPct
          })
        );
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadCountries = async () => {
      try {
        const options = await fetchCountryOptions();
        if (!cancelled && options.length > 0) {
          setCountries(options);
        }
      } catch {}
    };
    void loadCountries();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!form.country) return;
    let cancelled = false;
    const loadCities = async () => {
      setLoadingCities(true);
      try {
        const options = await fetchCityOptions(form.country);
        if (cancelled) return;
        const resolved = options.length ? options : getFallbackCitiesByCountry(form.country);
        setCities(resolved);
        setForm((prev) => ({
          ...prev,
          city: resolved.includes(prev.city) ? prev.city : resolved[0] || prev.city || ''
        }));
      } catch {
        if (!cancelled) {
          const fallback = getFallbackCitiesByCountry(form.country);
          setCities(fallback);
          setForm((prev) => ({
            ...prev,
            city: fallback.includes(prev.city) ? prev.city : fallback[0] || prev.city || ''
          }));
        }
      } finally {
        if (!cancelled) setLoadingCities(false);
      }
    };
    void loadCities();
    return () => {
      cancelled = true;
    };
  }, [form.country]);

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
    if (!value || schedules.includes(value)) return;
    setSchedules((prev) => [...prev, value]);
    setScheduleInput('');
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
    const current = [...sortedPhotos];
    const index = current.findIndex((photo) => photo.id === photoId);
    const targetIndex = index + direction;
    if (index === -1 || targetIndex < 0 || targetIndex >= current.length) return;
    [current[index], current[targetIndex]] = [current[targetIndex], current[index]];
    setPhotos(
      current.map((photo, currentIndex) => ({
        ...photo,
        sortOrder: currentIndex
      }))
    );
  };

  const removePhoto = (photoId: string) => {
    const next = sortedPhotos.filter((photo) => photo.id !== photoId);
    const hasCover = next.some((photo) => photo.isCover);
    setPhotos(
      next.map((photo, index) => ({
        ...photo,
        sortOrder: index,
        isCover: hasCover ? photo.isCover : index === 0
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

    setPhotos((prev) => [
      ...prev,
      {
        id: uid(),
        url: signed.publicUrl,
        sortOrder: prev.length,
        isCover: prev.length === 0
      }
    ]);
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

  const validateBeforeSubmit = () => {
    if (
      !form.country.trim() ||
      !form.region.trim() ||
      !form.city.trim() ||
      !form.zone.trim() ||
      !form.exactAddress.trim()
    ) {
      return 'Completa pais, region, ciudad, barrio/zona y direccion exacta.';
    }
    if (schedules.length === 0) {
      return 'Agrega al menos un horario disponible.';
    }
    if (form.adultMinAge <= form.childMaxAge) {
      return 'La edad minima de adulto debe ser mayor a la edad maxima de nino.';
    }
    if (form.childMaxAge < form.infantMaxAge) {
      return 'La edad maxima de nino debe ser mayor o igual a la de infante.';
    }
    return null;
  };

  const onSubmit = async () => {
    setSaving(true);
    setMessage('');
    setError('');

    const validationError = validateBeforeSubmit();
    if (validationError) {
      setSaving(false);
      setError(validationError);
      return;
    }

    const payload = {
      ...form,
      schedules,
      photos: sortedPhotos.map((photo, index) => ({
        url: photo.url,
        isCover: photo.isCover,
        sortOrder: index
      }))
    };

    try {
      const res = await fetch(
        isEdit ? `/api/host/experiences/${experienceId}` : '/api/host/experiences',
        {
          method: isEdit ? 'PUT' : 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-csrf-token': csrf
          },
          body: JSON.stringify(payload)
        }
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || 'No se pudo publicar la actividad.');
        setSaving(false);
        return;
      }
      setMessage(isEdit ? 'Actividad actualizada correctamente.' : 'Actividad publicada correctamente.');
      router.push(
        isEdit ? '/dashboard/host/explore/activities?updated=1' : '/dashboard/host/explore/activities?created=1'
      );
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
          <h2 className="text-xl font-semibold text-slate-900">
            {isEdit ? 'Editar actividad' : 'Publicar actividad'}
          </h2>
          <p className="text-sm text-slate-500">
            Completa una actividad con ubicacion internacional, modo de reserva y reglas de edad.
          </p>
        </div>
        <Button onClick={onSubmit} disabled={saving || uploading}>
          {saving ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Publicar actividad'}
        </Button>
      </div>

      {message && <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</p>}
      {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Nombre</p>
          <Input value={form.title} onChange={(e) => setForm((current) => ({ ...current, title: e.target.value }))} placeholder="Nombre de la actividad" />
        </div>
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Categoria</p>
          <select className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm" value={form.category} onChange={(e) => setForm((current) => ({ ...current, category: e.target.value }))}>
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </div>
        <div className="md:col-span-2">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Descripcion</p>
          <textarea className="min-h-[120px] w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm" value={form.description} onChange={(e) => setForm((current) => ({ ...current, description: e.target.value }))} placeholder="Describe que incluye la actividad, a quien esta dirigida y que la hace especial." />
        </div>
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Pais</p>
          <select className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm" value={form.country} onChange={(e) => setForm((current) => ({ ...current, country: e.target.value, city: '' }))}>
            {countries.map((country) => (
              <option key={country} value={country}>
                {country}
              </option>
            ))}
          </select>
        </div>
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Estado / provincia / region</p>
          <Input value={form.region} onChange={(e) => setForm((current) => ({ ...current, region: e.target.value }))} placeholder="Provincia, estado o region" />
        </div>
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Ciudad</p>
          <select className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm" value={form.city} onChange={(e) => setForm((current) => ({ ...current, city: e.target.value }))} disabled={loadingCities}>
            {cities.map((city) => (
              <option key={city} value={city}>
                {city}
              </option>
            ))}
          </select>
        </div>
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Barrio / zona</p>
          <Input value={form.zone} onChange={(e) => setForm((current) => ({ ...current, zone: e.target.value }))} placeholder="Zona o barrio" />
        </div>
        <div className="md:col-span-2">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Direccion exacta</p>
          <Input value={form.exactAddress} onChange={(e) => setForm((current) => ({ ...current, exactAddress: e.target.value }))} placeholder="Direccion exacta" />
        </div>
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Punto de encuentro</p>
          <Input value={form.meetingPoint} onChange={(e) => setForm((current) => ({ ...current, meetingPoint: e.target.value }))} placeholder="Lobby, boleteria, puerta principal, muelle..." />
        </div>
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Modalidad de reserva</p>
          <select className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm" value={form.bookingMode} onChange={(e) => setForm((current) => ({ ...current, bookingMode: e.target.value }))}>
            <option value="INSTANT">Reserva inmediata</option>
            <option value="INQUIRY">Solo consulta</option>
          </select>
        </div>
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Tipo</p>
          <select className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm" value={form.activityType} onChange={(e) => setForm((current) => ({ ...current, activityType: e.target.value }))}>
            <option value="SHARED">Compartida</option>
            <option value="PRIVATE">Privada</option>
          </select>
        </div>
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Tipo de cobertura</p>
          <select className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm" value={form.coverageType} onChange={(e) => setForm((current) => ({ ...current, coverageType: e.target.value }))}>
            <option value="FIXED">Punto fijo</option>
            <option value="PICKUP">Recogida / traslado</option>
          </select>
        </div>
        {form.coverageType === 'PICKUP' ? (
          <>
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Radio de cobertura (km)</p>
              <Input type="number" min={0} value={form.serviceRadiusKm} onChange={(e) => setForm((current) => ({ ...current, serviceRadiusKm: Number(e.target.value || 0) }))} />
            </div>
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Zonas cubiertas</p>
              <Input value={form.coveredZones} onChange={(e) => setForm((current) => ({ ...current, coveredZones: e.target.value }))} placeholder="Palermo, Recoleta, Centro" />
            </div>
          </>
        ) : null}
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Duracion (minutos)</p>
          <Input type="number" min={30} value={form.durationMinutes} onChange={(e) => setForm((current) => ({ ...current, durationMinutes: Number(e.target.value || 0) }))} />
        </div>
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Idioma</p>
          <Input value={form.language} onChange={(e) => setForm((current) => ({ ...current, language: e.target.value }))} placeholder="Espanol / Ingles" />
        </div>
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Precio adulto (USD)</p>
          <Input type="number" min={1} step="0.01" value={form.pricePerPerson} onChange={(e) => setForm((current) => ({ ...current, pricePerPerson: Number(e.target.value || 0) }))} />
        </div>
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Precio nino (USD)</p>
          <Input type="number" min={0} step="0.01" value={form.childPrice} onChange={(e) => setForm((current) => ({ ...current, childPrice: Number(e.target.value || 0) }))} />
        </div>
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Precio infante (USD)</p>
          <Input type="number" min={0} step="0.01" value={form.infantPrice} onChange={(e) => setForm((current) => ({ ...current, infantPrice: Number(e.target.value || 0) }))} />
        </div>
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Capacidad por salida</p>
          <Input type="number" min={1} value={form.capacity} onChange={(e) => setForm((current) => ({ ...current, capacity: Number(e.target.value || 0) }))} />
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <p className="text-sm font-semibold text-slate-900">Reglas de edad</p>
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Edad minima permitida</p>
            <Input type="number" min={0} value={form.minimumAge} onChange={(e) => setForm((current) => ({ ...current, minimumAge: Number(e.target.value || 0) }))} />
          </div>
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Max infante</p>
            <Input type="number" min={0} value={form.infantMaxAge} onChange={(e) => setForm((current) => ({ ...current, infantMaxAge: Number(e.target.value || 0) }))} />
          </div>
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Max nino</p>
            <Input type="number" min={0} value={form.childMaxAge} onChange={(e) => setForm((current) => ({ ...current, childMaxAge: Number(e.target.value || 0) }))} />
          </div>
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Min adulto</p>
            <Input type="number" min={1} value={form.adultMinAge} onChange={(e) => setForm((current) => ({ ...current, adultMinAge: Number(e.target.value || 0) }))} />
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <p className="text-sm font-semibold text-slate-900">Resumen de comisiones (USD)</p>
        <p className="mt-1 text-xs text-slate-500">
          Comision anfitrion {Math.round(pricingParams.platformPct * 100)}% · Tarifa huesped {Math.round(pricingParams.guestPct * 100)}%.
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
                  <span>Tarifa al cliente</span>
                  <span>USD {item.breakdown.guestFee.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Comision Hostea</span>
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
        <p className="text-sm font-semibold text-slate-900">Fecha, calendario y horarios</p>
        <p className="mt-1 text-xs text-slate-500">Para Shows puedes cargar horarios fijos, sectores y detalles operativos en requisitos.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Input value={scheduleInput} onChange={(e) => setScheduleInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSchedule(); } }} placeholder="Agregar horario o salida" className="max-w-sm" />
          <Button variant="outline" onClick={addSchedule}>
            Agregar horario
          </Button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {schedules.map((slot) => (
            <button key={slot} type="button" onClick={() => setSchedules((prev) => prev.filter((item) => item !== slot))} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-700 hover:bg-slate-100">
              {slot} x
            </button>
          ))}
          {schedules.length === 0 ? <p className="text-xs text-slate-500">Aun no agregaste horarios.</p> : null}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Que incluye</p>
          <textarea className="min-h-[110px] w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm" value={form.includesText} onChange={(e) => setForm((current) => ({ ...current, includesText: e.target.value }))} placeholder="Incluye transporte, guia, sectores, cena, entradas..." />
        </div>
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Que no incluye</p>
          <textarea className="min-h-[110px] w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm" value={form.excludesText} onChange={(e) => setForm((current) => ({ ...current, excludesText: e.target.value }))} placeholder="Traslados, consumos extra, propinas..." />
        </div>
        <div className="md:col-span-2">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Requisitos y notas operativas</p>
          <textarea className="min-h-[110px] w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm" value={form.requirementsText} onChange={(e) => setForm((current) => ({ ...current, requirementsText: e.target.value }))} placeholder="Edad minima, sectores, mesas, dress code, acceso, puntualidad, butacas..." />
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-900">Fotos</p>
            <p className="text-xs text-slate-500">Sube imagenes, elige portada y ordena como se mostraran en Explorar.</p>
          </div>
          <label className="pill-link cursor-pointer">
            {uploading ? 'Subiendo...' : 'Subir fotos'}
            <input type="file" className="hidden" accept="image/*" multiple onChange={(e) => onSelectFiles(e.target.files)} disabled={uploading} />
          </label>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sortedPhotos.map((photo, index) => (
            <div key={photo.id} className="rounded-2xl border border-slate-200 p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo.url} alt="Foto actividad" className="aspect-[4/3] w-full rounded-xl object-cover" />
              <div className="mt-2 flex items-center justify-between gap-2 text-xs">
                <button type="button" onClick={() => setCover(photo.id)} className={photo.isCover ? 'font-semibold text-emerald-600' : 'text-slate-600'}>
                  {photo.isCover ? 'Portada' : 'Definir portada'}
                </button>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => movePhoto(photo.id, -1)} disabled={index === 0} className="text-slate-600 disabled:opacity-40">
                    Arriba
                  </button>
                  <button type="button" onClick={() => movePhoto(photo.id, 1)} disabled={index === sortedPhotos.length - 1} className="text-slate-600 disabled:opacity-40">
                    Abajo
                  </button>
                  <button type="button" onClick={() => removePhoto(photo.id)} className="text-red-600">
                    Eliminar
                  </button>
                </div>
              </div>
            </div>
          ))}
          {sortedPhotos.length === 0 ? <p className="text-sm text-slate-500">Aun no hay fotos cargadas.</p> : null}
        </div>
      </div>
    </div>
  );
}
