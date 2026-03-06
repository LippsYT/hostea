import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getEffectiveRoles } from '@/lib/server-roles';
import { redirect } from 'next/navigation';
import { Compass, PlusCircle, Ticket, CalendarDays, MessageCircle, BarChart3 } from 'lucide-react';

const actions = [
  {
    href: '/dashboard/host/explore/activities',
    title: 'Mis actividades',
    description: 'Listado de actividades turisticas publicadas.',
    icon: Compass
  },
  {
    href: '/dashboard/host/explore/new',
    title: 'Crear actividad',
    description: 'Nuevo tour, paseo o experiencia cultural.',
    icon: PlusCircle
  },
  {
    href: '/dashboard/host/explore/reservations',
    title: 'Reservas',
    description: 'Solicitudes, aprobaciones y pagos de actividades.',
    icon: Ticket
  },
  {
    href: '/dashboard/host/explore/calendar',
    title: 'Calendario',
    description: 'Horarios, cupos y bloqueos por fecha.',
    icon: CalendarDays
  },
  {
    href: '/dashboard/host/explore/reviews',
    title: 'Resenas',
    description: 'Opiniones y calificacion de los clientes.',
    icon: MessageCircle
  },
  {
    href: '/dashboard/host/explore/stats',
    title: 'Estadisticas',
    description: 'Conversion, ingresos y actividad por ciudad.',
    icon: BarChart3
  }
];

export default async function HostExplorePage() {
  const session = await getServerSession(authOptions);
  const sessionUserId = (session?.user as any)?.id as string | undefined;
  const roles = await getEffectiveRoles(sessionUserId, (session?.user as any)?.roles);
  if (!roles.includes('HOST') && !roles.includes('ADMIN')) {
    redirect('/dashboard');
  }

  return (
    <div className="space-y-8">
      <div>
        <p className="section-subtitle">Panel Host</p>
        <h1 className="section-title">Explorar</h1>
        <p className="mt-2 text-sm text-slate-500">
          Gestiona actividades turisticas globales y convierte consultas en reservas.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {actions.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="rounded-3xl border border-slate-200/70 bg-white/85 p-5 shadow-soft transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="flex items-center gap-3">
              <span className="brand-gradient-bg inline-flex h-10 w-10 items-center justify-center rounded-xl text-white">
                <item.icon className="h-5 w-5" />
              </span>
              <h2 className="text-base font-semibold text-slate-900">{item.title}</h2>
            </div>
            <p className="mt-3 text-sm text-slate-600">{item.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
