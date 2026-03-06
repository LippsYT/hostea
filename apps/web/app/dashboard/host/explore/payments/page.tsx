import { requireExperienceHostAccess } from '@/lib/experience-access';
import { prisma } from '@/lib/db';

export default async function HostExplorePaymentsPage() {
  const { userId } = await requireExperienceHostAccess();
  const [paid, pending, failed] = await Promise.all([
    prisma.experienceBooking.aggregate({
      where: { experience: { hostId: userId }, status: 'PAID' },
      _sum: { total: true },
      _count: true
    }),
    prisma.experienceBooking.aggregate({
      where: { experience: { hostId: userId }, status: 'PENDING' },
      _sum: { total: true },
      _count: true
    }),
    prisma.experienceBooking.aggregate({
      where: { experience: { hostId: userId }, status: 'FAILED' },
      _sum: { total: true },
      _count: true
    })
  ]);

  return (
    <div className="space-y-6">
      <div>
        <p className="section-subtitle">Explorar</p>
        <h1 className="section-title">Pagos de experiencias</h1>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="surface-card">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Pagados</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">
            USD {Number(paid._sum.total || 0).toFixed(2)}
          </p>
          <p className="text-sm text-slate-500">{paid._count} reservas</p>
        </div>
        <div className="surface-card">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Pendientes</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">
            USD {Number(pending._sum.total || 0).toFixed(2)}
          </p>
          <p className="text-sm text-slate-500">{pending._count} reservas</p>
        </div>
        <div className="surface-card">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Fallidos</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">
            USD {Number(failed._sum.total || 0).toFixed(2)}
          </p>
          <p className="text-sm text-slate-500">{failed._count} reservas</p>
        </div>
      </div>
    </div>
  );
}
