import { prisma } from '@/lib/db';
import { AdminSettingsForm } from '@/components/admin-settings-form';
import { AdminLegalForm } from '@/components/admin-legal-form';
import { AdminDashboard } from '@/components/admin-dashboard';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import {
  buildSupabaseAuthIndex,
  listSupabaseAuthUsers,
  resolveSupabaseAuthForLocalUser
} from '@/lib/supabase-auth-users';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const session = await getServerSession(authOptions);
  const roles = (session?.user as any)?.roles || [];
  if (!roles.includes('ADMIN')) {
    redirect('/dashboard');
  }

  const settings = await prisma.settings.findMany();
  const settingsMap = settings.reduce((acc, s) => ({ ...acc, [s.key]: s.value }), {} as Record<string, any>);
  const legalPages = await prisma.legalPage.findMany({ orderBy: { slug: 'asc' } });

  const users = await prisma.user.findMany({
    include: { profile: true, roles: { include: { role: true } } },
    orderBy: { createdAt: 'desc' }
  });
  const listings = await prisma.listing.findMany({
    include: { host: true },
    orderBy: { createdAt: 'desc' }
  });
  const kycs = await prisma.kycSubmission.findMany({
    include: { user: true },
    orderBy: { createdAt: 'desc' }
  });
  const reservations = await prisma.reservation.findMany({
    include: { listing: true, user: true },
    orderBy: { createdAt: 'desc' }
  });
  const audit = await prisma.auditLog.findMany({
    include: { actor: true },
    orderBy: { createdAt: 'desc' },
    take: 200
  });
  let accessLogs: Array<{
    id: string;
    createdAt: Date;
    role: string;
    ip: string | null;
    userAgent: string | null;
    user: { email: string; profile: { name: string | null } | null };
  }> = [];
  let notifications: Array<{
    id: string;
    title: string;
    body: string;
    createdAt: Date;
  }> = [];

  try {
    accessLogs = await prisma.accessLog.findMany({
      include: { user: { include: { profile: true } } },
      orderBy: { createdAt: 'desc' },
      take: 20
    });
  } catch {
    accessLogs = [];
  }

  try {
    notifications = await prisma.notification.findMany({
      where: { userId: (session?.user as any)?.id as string },
      orderBy: { createdAt: 'desc' },
      take: 20
    });
  } catch {
    notifications = [];
  }

  let authIndex = buildSupabaseAuthIndex([]);
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const supabaseUsers = await listSupabaseAuthUsers();
      authIndex = buildSupabaseAuthIndex(supabaseUsers);
    } catch {
      authIndex = buildSupabaseAuthIndex([]);
    }
  }

  const safeUsers = users.map((u) => {
    const authMatch = resolveSupabaseAuthForLocalUser({ id: u.id, email: u.email }, authIndex);
    return {
      id: u.id,
      email: u.email,
      name: u.profile?.name || '',
      role: u.roles[0]?.role.name || 'CLIENT',
      emailVerified: Boolean(u.emailVerified),
      authStatus: authMatch.status,
      authSupabaseUserId: authMatch.user?.id || null
    };
  });
  const safeListings = listings.map((l) => ({
    id: l.id,
    title: l.title,
    status: l.status,
    hostEmail: l.host.email
  }));
  const safeKycs = kycs.map((k) => ({
    id: k.id,
    userEmail: k.user.email,
    status: k.status
  }));
  const safeReservations = reservations.map((r) => ({
    id: r.id,
    listingTitle: r.listing.title,
    userEmail: r.user.email,
    status: r.status,
    total: Number(r.total)
  }));
  const safeAudit = audit.map((a) => ({
    id: a.id,
    action: a.action,
    entity: a.entity,
    entityId: a.entityId,
    actorEmail: a.actor.email,
    createdAt: a.createdAt.toISOString()
  }));

  return (
    <div className="space-y-8">
      <div>
        <p className="section-subtitle">Panel Admin</p>
        <h1 className="section-title">Control total de la plataforma</h1>
      </div>
      <AdminSettingsForm initial={settingsMap} />
      <div className="space-y-4">
        <div>
          <p className="section-subtitle">CMS legal</p>
          <h2 className="text-xl font-semibold text-slate-900">Documentos legales</h2>
        </div>
        <AdminLegalForm pages={legalPages.map((p) => ({ slug: p.slug, title: p.title, content: p.content }))} />
      </div>
      <AdminDashboard
        users={safeUsers}
        listings={safeListings}
        kycs={safeKycs}
        reservations={safeReservations}
        audit={safeAudit}
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="surface-card space-y-4">
          <div>
            <p className="section-subtitle">Accesos recientes</p>
            <h2 className="text-xl font-semibold text-slate-900">Actividad de login</h2>
          </div>
          <div className="space-y-3">
            {accessLogs.map((access) => {
              const displayName = access.user.profile?.name || access.user.email;
              return (
                <div key={access.id} className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                  <p className="text-sm font-semibold text-slate-900">
                    Ingreso {displayName} - {access.role} - {new Date(access.createdAt).toLocaleString('es-AR')}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {access.ip || 'IP no disponible'} · {access.userAgent || 'User-Agent no disponible'}
                  </p>
                </div>
              );
            })}
            {accessLogs.length === 0 ? (
              <p className="text-sm text-slate-500">Sin accesos recientes.</p>
            ) : null}
          </div>
        </section>

        <section className="surface-card space-y-4">
          <div>
            <p className="section-subtitle">Notificaciones</p>
            <h2 className="text-xl font-semibold text-slate-900">Actividad reciente</h2>
          </div>
          <div className="space-y-3">
            {notifications.map((notification) => (
              <div key={notification.id} className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <p className="text-sm font-semibold text-slate-900">{notification.title}</p>
                <p className="mt-1 text-sm text-slate-600">{notification.body}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {new Date(notification.createdAt).toLocaleString('es-AR')}
                </p>
              </div>
            ))}
            {notifications.length === 0 ? (
              <p className="text-sm text-slate-500">Sin actividad reciente.</p>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}
