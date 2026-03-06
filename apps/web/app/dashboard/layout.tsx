import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { ReservationAlerts } from '@/components/reservation-alerts';
import { DashboardShell } from '@/components/dashboard-shell';
import { getEffectiveRoles } from '@/lib/server-roles';

type NavItem = { href: string; label: string; roles?: string[] };

const navItems: NavItem[] = [
  { href: '/dashboard', label: 'Resumen' },
  { href: '/dashboard/host', label: 'Host', roles: ['HOST', 'ADMIN'] },
  {
    href: '/dashboard/host/explore',
    label: 'Explorar',
    roles: ['HOST', 'EXPERIENCE_HOST', 'ADMIN']
  },
  {
    href: '/dashboard/host/messages',
    label: 'Mensajes',
    roles: ['HOST', 'EXPERIENCE_HOST', 'ADMIN']
  },
  { href: '/dashboard/host/listings', label: 'Propiedades', roles: ['HOST', 'ADMIN'] },
  { href: '/dashboard/host/reservations', label: 'Reservas', roles: ['HOST', 'ADMIN'] },
  { href: '/dashboard/host/calendar', label: 'Calendario', roles: ['HOST', 'ADMIN'] },
  { href: '/dashboard/host/finance', label: 'Finanzas', roles: ['HOST', 'ADMIN'] },
  { href: '/dashboard/host/notifications', label: 'Notificaciones', roles: ['HOST', 'ADMIN'] },
  { href: '/dashboard/client', label: 'Reservar', roles: ['CLIENT', 'ADMIN'] },
  {
    href: '/dashboard/client/messages',
    label: 'Mensajes',
    roles: ['CLIENT', 'HOST', 'EXPERIENCE_HOST', 'ADMIN']
  },
  {
    href: '/dashboard/client/profile',
    label: 'Perfil y KYC',
    roles: ['CLIENT', 'HOST', 'EXPERIENCE_HOST', 'ADMIN']
  },
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
  const roles = await getEffectiveRoles(user?.id as string | undefined, user?.roles);
  const displayName = user?.name || user?.email || 'Invitado';
  const roleLabel = roles.join(' · ') || 'Usuario';

  const allowedNavItems = navItems
    .filter((item) => hasRole(roles, item.roles))
    .map((item) => ({ key: item.href, href: item.href, label: item.label }))
    .filter((item, index, arr) => arr.findIndex((x) => x.href === item.href) === index);

  return (
    <div className="min-h-screen bg-transparent">
      <ReservationAlerts roles={roles} />
      <DashboardShell navItems={allowedNavItems} displayName={displayName} roleLabel={roleLabel}>
        {children}
      </DashboardShell>
    </div>
  );
}
