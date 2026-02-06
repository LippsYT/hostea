import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { ReservationAlerts } from '@/components/reservation-alerts';

type NavItem = { href: string; label: string; roles?: string[] };

const navItems: NavItem[] = [
  { href: '/dashboard', label: 'Resumen' },
  { href: '/dashboard/host', label: 'Host', roles: ['HOST', 'ADMIN'] },
  { href: '/dashboard/host/messages', label: 'Mensajes', roles: ['HOST', 'ADMIN'] },
  { href: '/dashboard/host/listings', label: 'Propiedades', roles: ['HOST', 'ADMIN'] },
  { href: '/dashboard/host/reservations', label: 'Reservas', roles: ['HOST', 'ADMIN'] },
  { href: '/dashboard/host/calendar', label: 'Calendario', roles: ['HOST', 'ADMIN'] },
  { href: '/dashboard/host/finance', label: 'Finanzas', roles: ['HOST', 'ADMIN'] },
  { href: '/dashboard/client', label: 'Reservar', roles: ['CLIENT', 'ADMIN'] },
  { href: '/dashboard/client/messages', label: 'Mensajes', roles: ['CLIENT', 'HOST', 'ADMIN'] },
  { href: '/dashboard/client/profile', label: 'Perfil y KYC', roles: ['CLIENT', 'HOST', 'ADMIN'] },
  { href: '/dashboard/support', label: 'Soporte', roles: ['SUPPORT', 'MODERATOR', 'ADMIN'] },
  { href: '/dashboard/admin', label: 'Admin', roles: ['ADMIN'] },
  { href: '/dashboard/admin/finance', label: 'Admin Finanzas', roles: ['ADMIN'] }
];

const hasRole = (userRoles: string[], itemRoles?: string[]) => {
  if (!itemRoles || itemRoles.length === 0) return true;
  return itemRoles.some((role) => userRoles.includes(role));
};

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
  const roles = (user?.roles || []) as string[];
  const displayName = user?.name || user?.email || 'Invitado';
  const roleLabel = roles.join(' · ') || 'Usuario';

  return (
    <div className="min-h-screen bg-slate-950/5">
      <ReservationAlerts roles={roles} />
      <div className="grid min-h-screen lg:grid-cols-[260px_1fr]">
        <aside className="hidden border-r border-slate-200/70 bg-white/80 p-6 backdrop-blur lg:block">
          <div className="flex items-center justify-between">
            <Link href="/" className="text-xl font-semibold tracking-tight">
              HOSTEA
            </Link>
            <span className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
              Pro
            </span>
          </div>
          <div className="mt-6 rounded-2xl border border-slate-200/70 bg-white/70 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Cuenta</p>
            <p className="mt-2 text-sm font-semibold text-slate-900">{displayName}</p>
            <p className="text-xs text-slate-500">{roleLabel}</p>
          </div>
          <nav className="mt-6 space-y-1 text-sm">
            {navItems.filter((item) => hasRole(roles, item.roles)).map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center justify-between rounded-full px-4 py-2 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
              >
                <span>{item.label}</span>
                <span className="h-1.5 w-1.5 rounded-full bg-slate-200" />
              </Link>
            ))}
          </nav>
        </aside>

        <div className="min-h-screen">
          <header className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/80 backdrop-blur">
            <div className="mx-auto flex max-w-6xl flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between lg:px-10">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">Panel</p>
                <h1 className="text-xl font-semibold text-slate-900">HOSTEA Studio</h1>
              </div>
              <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
                <Link
                  href="/"
                  className="flex-1 rounded-full border border-slate-200/70 px-4 py-2 text-center text-xs font-semibold uppercase tracking-wide text-slate-600 hover:bg-slate-50 sm:flex-none"
                >
                  Ir al sitio
                </Link>
                <Link
                  href="/auth/sign-in"
                  className="flex-1 rounded-full bg-slate-900 px-4 py-2 text-center text-xs font-semibold uppercase tracking-wide text-white hover:bg-slate-800 sm:flex-none"
                >
                  Cambiar cuenta
                </Link>
              </div>
            </div>
          </header>
          <main className="px-6 pb-16 pt-8 lg:px-10">
            <div className="mx-auto max-w-6xl">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}
