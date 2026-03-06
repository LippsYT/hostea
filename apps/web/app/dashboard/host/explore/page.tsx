import Link from 'next/link';
import { Compass, PlusCircle, Ticket, CalendarDays, Wallet } from 'lucide-react';
import { requireExperienceHostAccess } from '@/lib/experience-access';
import { prisma } from '@/lib/db';

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
    href: '/dashboard/host/explore/payments',
    title: 'Pagos',
    description: 'Estado de cobros y total generado por experiencias.',
    icon: Wallet
  }
];

export default async function HostExplorePage() {
  const { userId } = await requireExperienceHostAccess();
  const [experienceCount, bookingCount, paidTotal] = await Promise.all([
    prisma.experience.count({ where: { hostId: userId } }),
    prisma.experienceBooking.count({
      where: {
        experience: { hostId: userId }
      }
    }),
    prisma.experienceBooking.aggregate({
      where: {
        experience: { hostId: userId },
        status: 'PAID'
      },
      _sum: { total: true }
    })
  ]);

  return (
    <div className="space-y-8">
      <div>
        <p className="section-subtitle">Panel Host</p>
        <h1 className="section-title">Explorar</h1>
        <p className="mt-2 text-sm text-slate-500">
          Gestiona actividades turisticas globales y convierte consultas en reservas.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="surface-card">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Actividades</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{experienceCount}</p>
          <p className="text-sm text-slate-500">Publicadas por tu cuenta</p>
        </div>
        <div className="surface-card">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Reservas</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{bookingCount}</p>
          <p className="text-sm text-slate-500">Solicitudes y confirmaciones</p>
        </div>
        <div className="surface-card">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Pagos</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">
            USD {Number(paidTotal._sum.total || 0).toFixed(2)}
          </p>
          <p className="text-sm text-slate-500">Total pagado en experiencias</p>
        </div>
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
