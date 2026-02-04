'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  ArrowRight,
  CheckCircle,
  Home,
  MapPin,
  Camera,
  Sparkles,
  Shield,
  Users,
  Bed,
  Bath,
  DollarSign,
  CalendarCheck,
  Wand2
} from 'lucide-react';

const propertyTypes = [
  { key: 'APARTMENT', label: 'Departamento', icon: Home },
  { key: 'HOTEL', label: 'Hotel', icon: Sparkles }
];

const vibeOptions = ['Tranquilo', 'Unico', 'Ideal para familias', 'Elegante', 'Central', 'Espacioso'];

const amenityOptions = [
  'Wifi',
  'TV',
  'Cocina',
  'Aire acondicionado',
  'Estacionamiento',
  'Zona de trabajo',
  'Pileta',
  'Jacuzzi',
  'Parrilla'
];

type GuestCounts = {
  guests: number;
  beds: number;
  baths: number;
};

export const HostOnboarding = () => {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [showOffer, setShowOffer] = useState(true);
  const [csrf, setCsrf] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedType, setSelectedType] = useState<'APARTMENT' | 'HOTEL'>('APARTMENT');
  const [vibes, setVibes] = useState<string[]>(['Tranquilo', 'Central']);
  const [amenities, setAmenities] = useState<string[]>(['Wifi', 'Cocina']);
  const [counts, setCounts] = useState<GuestCounts>({ guests: 4, beds: 1, baths: 1 });
  const [address, setAddress] = useState({
    address: '',
    city: 'Buenos Aires',
    neighborhood: ''
  });
  const [details, setDetails] = useState({
    title: '',
    description: ''
  });
  const [pricing, setPricing] = useState({
    pricePerNight: 70,
    cancelPolicy: 'FLEXIBLE'
  });

  useEffect(() => {
    fetch('/api/security/csrf').then(async (res) => {
      const data = await res.json();
      setCsrf(data.token);
    });
  }, []);

  const totalSteps = 6;

  const pricePreview = useMemo(() => {
    const base = pricing.pricePerNight;
    const serviceFee = 10;
    const cleaningFee = 10;
    const guestPrice = base + serviceFee;
    const total = base + serviceFee + cleaningFee;
    return { base, serviceFee, cleaningFee, guestPrice, total };
  }, [pricing.pricePerNight]);

  const toggleList = (list: string[], value: string) =>
    list.includes(value) ? list.filter((item) => item !== value) : [...list, value];

  const createListing = async () => {
    setLoading(true);
    try {
      const payload = {
        title: details.title || `Nuevo ${selectedType === 'HOTEL' ? 'Hotel' : 'Departamento'}`,
        description:
          details.description ||
          `Espacio ${vibes.join(', ').toLowerCase()} con amenities esenciales.`,
        type: selectedType,
        address: address.address || 'Direccion pendiente',
        city: address.city || 'Buenos Aires',
        neighborhood: address.neighborhood || 'Palermo',
        pricePerNight: pricing.pricePerNight,
        capacity: counts.guests,
        beds: counts.beds,
        baths: counts.baths,
        cancelPolicy: pricing.cancelPolicy
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
      if (data.listing?.id) {
        router.push(`/dashboard/host/listings/${data.listing.id}`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      {showOffer && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-6 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl bg-white p-8 shadow-2xl">
            <div className="flex justify-between">
              <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-600">
                Nuevo
              </div>
              <button
                type="button"
                onClick={() => setShowOffer(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                ✕
              </button>
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              {[
                { label: 'Alojamiento', icon: Home },
                { label: 'Experiencia', icon: Sparkles, disabled: true },
                { label: 'Servicio', icon: Wand2, disabled: true }
              ].map((item) => (
                <button
                  key={item.label}
                  type="button"
                  className={`rounded-2xl border px-4 py-6 text-center transition ${
                    item.disabled
                      ? 'border-slate-200/60 text-slate-400'
                      : 'border-slate-200 hover:border-slate-400'
                  }`}
                  onClick={() => !item.disabled && setShowOffer(false)}
                >
                  <item.icon className={`mx-auto h-8 w-8 ${item.disabled ? '' : 'float-mid text-slate-700'}`} />
                  <p className="mt-3 text-sm font-semibold">{item.label}</p>
                  {item.disabled && <p className="mt-1 text-xs">Proximamente</p>}
                </button>
              ))}
            </div>
            <Button className="mt-6 w-full" onClick={() => setShowOffer(false)}>
              Continuar
            </Button>
          </div>
        </div>
      )}

      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white">
              <Home className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Modo anfitrion</p>
              <h1 className="text-xl font-semibold">Publica tu espacio en HOSTEA</h1>
            </div>
          </div>
          <div className="hidden items-center gap-2 text-xs text-slate-500 md:flex">
            <CheckCircle className="h-4 w-4 text-emerald-500" />
            <span>Progreso {step}/{totalSteps}</span>
          </div>
        </div>

        <div className="mt-6 h-1 w-full rounded-full bg-slate-100">
          <div
            className="h-1 rounded-full bg-slate-900 transition-all"
            style={{ width: `${(step / totalSteps) * 100}%` }}
          />
        </div>

        <div className="mt-10 grid gap-10 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-10">
            {step === 0 && (
              <section className="animate-fade-up">
                <p className="text-sm text-slate-500">Paso 1</p>
                <h2 className="mt-2 text-3xl font-semibold">Contanos acerca de tu alojamiento</h2>
                <p className="mt-3 text-sm text-slate-500">
                  Elegi el tipo de propiedad y definí la capacidad para huéspedes.
                </p>
                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  {propertyTypes.map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => setSelectedType(item.key as 'APARTMENT' | 'HOTEL')}
                      className={`rounded-3xl border p-5 text-left transition ${
                        selectedType === item.key
                          ? 'border-slate-900 bg-slate-50'
                          : 'border-slate-200 hover:border-slate-400'
                      }`}
                    >
                      <item.icon className="h-6 w-6 text-slate-700" />
                      <p className="mt-3 text-sm font-semibold">{item.label}</p>
                      <p className="mt-1 text-xs text-slate-500">Ideal para viajeros exigentes.</p>
                    </button>
                  ))}
                </div>

                <div className="mt-6 grid gap-4 sm:grid-cols-3">
                  {[
                    { label: 'Viajeros', key: 'guests', icon: Users },
                    { label: 'Camas', key: 'beds', icon: Bed },
                    { label: 'Baños', key: 'baths', icon: Bath }
                  ].map((item) => (
                    <div key={item.key} className="rounded-2xl border border-slate-200 p-4">
                      <div className="flex items-center gap-2 text-sm text-slate-600">
                        <item.icon className="h-4 w-4" />
                        {item.label}
                      </div>
                      <div className="mt-4 flex items-center justify-between">
                        <button
                          type="button"
                          className="h-8 w-8 rounded-full border"
                          onClick={() =>
                            setCounts((prev) => ({
                              ...prev,
                              [item.key]: Math.max(1, prev[item.key as keyof GuestCounts] - 1)
                            }))
                          }
                        >
                          -
                        </button>
                        <span className="text-lg font-semibold">{counts[item.key as keyof GuestCounts]}</span>
                        <button
                          type="button"
                          className="h-8 w-8 rounded-full border"
                          onClick={() =>
                            setCounts((prev) => ({
                              ...prev,
                              [item.key]: prev[item.key as keyof GuestCounts] + 1
                            }))
                          }
                        >
                          +
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {step === 1 && (
              <section className="animate-fade-up">
                <p className="text-sm text-slate-500">Paso 2</p>
                <h2 className="mt-2 text-3xl font-semibold">Ubicacion y direccion</h2>
                <p className="mt-3 text-sm text-slate-500">
                  Solo compartimos la direccion completa cuando hay una reserva confirmada.
                </p>
                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <Input
                    placeholder="Direccion"
                    value={address.address}
                    onChange={(e) => setAddress((prev) => ({ ...prev, address: e.target.value }))}
                  />
                  <Input
                    placeholder="Barrio"
                    value={address.neighborhood}
                    onChange={(e) => setAddress((prev) => ({ ...prev, neighborhood: e.target.value }))}
                  />
                  <Input
                    placeholder="Ciudad"
                    value={address.city}
                    onChange={(e) => setAddress((prev) => ({ ...prev, city: e.target.value }))}
                  />
                </div>
                <div className="mt-6 rounded-3xl border border-slate-200 p-6">
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <MapPin className="h-4 w-4" />
                    Mapa interactivo (se agrega en la siguiente iteracion)
                  </div>
                  <div className="mt-4 h-60 rounded-2xl bg-slate-100" />
                </div>
              </section>
            )}

            {step === 2 && (
              <section className="animate-fade-up">
                <p className="text-sm text-slate-500">Paso 3</p>
                <h2 className="mt-2 text-3xl font-semibold">Que ofrece tu espacio</h2>
                <p className="mt-3 text-sm text-slate-500">Selecciona servicios clave.</p>
                <div className="mt-6 grid gap-3 sm:grid-cols-3">
                  {amenityOptions.map((amenity) => (
                    <button
                      key={amenity}
                      type="button"
                      onClick={() => setAmenities((prev) => toggleList(prev, amenity))}
                      className={`rounded-2xl border px-4 py-3 text-sm transition ${
                        amenities.includes(amenity)
                          ? 'border-slate-900 bg-slate-50'
                          : 'border-slate-200 hover:border-slate-400'
                      }`}
                    >
                      {amenity}
                    </button>
                  ))}
                </div>
              </section>
            )}

            {step === 3 && (
              <section className="animate-fade-up">
                <p className="text-sm text-slate-500">Paso 4</p>
                <h2 className="mt-2 text-3xl font-semibold">Mostra tu espacio</h2>
                <p className="mt-3 text-sm text-slate-500">Vas a poder subir fotos en el editor final.</p>
                <div className="mt-6 rounded-3xl border border-dashed border-slate-300 p-10 text-center">
                  <Camera className="mx-auto h-10 w-10 text-slate-400" />
                  <p className="mt-3 text-sm text-slate-500">Subi al menos 5 fotos para destacar.</p>
                </div>
              </section>
            )}

            {step === 4 && (
              <section className="animate-fade-up">
                <p className="text-sm text-slate-500">Paso 5</p>
                <h2 className="mt-2 text-3xl font-semibold">Titulo y descripcion</h2>
                <div className="mt-6 space-y-4">
                  <Input
                    placeholder="Titulo"
                    value={details.title}
                    onChange={(e) => setDetails((prev) => ({ ...prev, title: e.target.value }))}
                  />
                  <textarea
                    className="w-full rounded-2xl border border-slate-200 p-4 text-sm"
                    rows={5}
                    placeholder="Descripcion"
                    value={details.description}
                    onChange={(e) => setDetails((prev) => ({ ...prev, description: e.target.value }))}
                  />
                  <div className="flex flex-wrap gap-2">
                    {vibeOptions.map((vibe) => (
                      <button
                        key={vibe}
                        type="button"
                        onClick={() => setVibes((prev) => toggleList(prev, vibe))}
                        className={`rounded-full border px-3 py-1 text-xs ${
                          vibes.includes(vibe) ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200'
                        }`}
                      >
                        {vibe}
                      </button>
                    ))}
                  </div>
                </div>
              </section>
            )}

            {step === 5 && (
              <section className="animate-fade-up">
                <p className="text-sm text-slate-500">Paso 6</p>
                <h2 className="mt-2 text-3xl font-semibold">Precio y reservas</h2>
                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 p-4">
                    <p className="text-sm text-slate-500">Precio base por noche</p>
                    <div className="mt-3 flex items-center gap-2 text-3xl font-semibold">
                      <DollarSign className="h-6 w-6" />
                      <input
                        type="number"
                        className="w-28 border-b border-slate-200 text-3xl outline-none"
                        value={pricing.pricePerNight}
                        onChange={(e) =>
                          setPricing((prev) => ({ ...prev, pricePerNight: Number(e.target.value) }))
                        }
                      />
                    </div>
                    <p className="mt-4 text-xs text-slate-500">Total estimado al huesped: USD {pricePreview.total}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 p-4">
                    <p className="text-sm text-slate-500">Politica de cancelacion</p>
                    <select
                      className="mt-3 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                      value={pricing.cancelPolicy}
                      onChange={(e) => setPricing((prev) => ({ ...prev, cancelPolicy: e.target.value }))}
                    >
                      <option value="FLEXIBLE">Flexible</option>
                      <option value="MODERATE">Moderada</option>
                      <option value="STRICT">Estricta</option>
                    </select>
                    <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
                      <CalendarCheck className="h-4 w-4" />
                      La reserva queda confirmada con pago.
                    </div>
                  </div>
                </div>
              </section>
            )}
          </div>

          <aside className="space-y-6">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-3">
                <Shield className="h-6 w-6 text-slate-700" />
                <div>
                  <p className="text-sm font-semibold">Checklist de anfitrion</p>
                  <p className="text-xs text-slate-500">Todo lo necesario para publicar.</p>
                </div>
              </div>
              <ul className="mt-4 space-y-3 text-sm text-slate-600">
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-emerald-500" />
                  Datos basicos completados
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-emerald-500" />
                  Configuracion de precios
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-emerald-500" />
                  Seguridad y normas
                </li>
              </ul>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-sm font-semibold">Siguiente paso</p>
              <p className="mt-2 text-xs text-slate-500">
                Subiras fotos y podras ajustar todo desde el panel del host.
              </p>
            </div>
          </aside>
        </div>

        <div className="mt-10 flex items-center justify-between">
          <Button variant="outline" onClick={() => setStep((prev) => Math.max(0, prev - 1))}>
            Atras
          </Button>
          {step < totalSteps ? (
            <Button onClick={() => setStep((prev) => Math.min(totalSteps, prev + 1))}>
              Siguiente
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={createListing} disabled={loading}>
              {loading ? 'Creando...' : 'Crear anuncio'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
