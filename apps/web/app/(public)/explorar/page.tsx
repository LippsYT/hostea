import Link from 'next/link';
import { Compass, CalendarDays, Ticket, Globe2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

const blocks = [
  {
    title: 'Mis actividades',
    description: 'Administra tours, paseos y experiencias publicadas.',
    href: '/dashboard/host/explore/activities',
    icon: Compass
  },
  {
    title: 'Crear actividad',
    description: 'Publica una nueva actividad con fotos, horarios y precios.',
    href: '/dashboard/host/explore/new',
    icon: Sparkles
  },
  {
    title: 'Reservas',
    description: 'Revisa solicitudes y confirmaciones de actividades.',
    href: '/dashboard/host/explore/reservations',
    icon: Ticket
  },
  {
    title: 'Calendario',
    description: 'Gestiona cupos por fecha y horarios de salida.',
    href: '/dashboard/host/explore/calendar',
    icon: CalendarDays
  }
];

export default function ExplorePage() {
  return (
    <section className="px-4 pb-20 pt-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-8">
        <div className="rounded-3xl border border-slate-200/70 bg-white/85 p-8 shadow-soft backdrop-blur">
          <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Nueva seccion</p>
          <h1 className="mt-4 text-4xl font-semibold leading-tight text-slate-900 md:text-5xl">
            EXPLORAR en HOSTEA
          </h1>
          <p className="mt-4 max-w-3xl text-base text-slate-600 md:text-lg">
            Publica y vende actividades turisticas de forma global: tours, paseos, excursiones
            y experiencias culturales para viajeros de cualquier ciudad.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/search">
              <Button size="lg" variant="outline">
                Ver alojamientos
              </Button>
            </Link>
            <Link href="/dashboard/host/explore">
              <Button size="lg">Ir al panel Explorar</Button>
            </Link>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {blocks.map((block) => (
            <Link
              key={block.title}
              href={block.href}
              className="rounded-3xl border border-slate-200/70 bg-white/85 p-6 shadow-soft transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="flex items-center gap-3">
                <span className="brand-gradient-bg float-fast inline-flex h-10 w-10 items-center justify-center rounded-xl text-white">
                  <block.icon className="h-5 w-5" />
                </span>
                <h2 className="text-lg font-semibold text-slate-900">{block.title}</h2>
              </div>
              <p className="mt-3 text-sm text-slate-600">{block.description}</p>
            </Link>
          ))}
        </div>

        <div className="rounded-3xl border border-slate-200/70 bg-white/85 p-6 text-sm text-slate-600 shadow-soft">
          <div className="flex items-center gap-2 font-semibold text-slate-900">
            <Globe2 className="h-4 w-4 text-[var(--brand-2)]" />
            Alcance global
          </div>
          <p className="mt-2">
            EXPLORAR permite que anfitriones de distintas ciudades publiquen actividades y que
            clientes descubran opciones por ubicacion, fecha, categoria y precio.
          </p>
        </div>
      </div>
    </section>
  );
}
