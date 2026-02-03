import { prisma } from '@/lib/db';
import { AdminSettingsForm } from '@/components/admin-settings-form';
import { AdminLegalForm } from '@/components/admin-legal-form';
import { AdminDashboard } from '@/components/admin-dashboard';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';

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

  const safeUsers = users.map((u) => ({
    id: u.id,
    email: u.email,
    name: u.profile?.name || '',
    role: u.roles[0]?.role.name || 'CLIENT'
  }));
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
    </div>
  );
}
