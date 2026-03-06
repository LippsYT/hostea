import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getEffectiveRoles } from '@/lib/server-roles';
import { redirect } from 'next/navigation';
import Link from 'next/link';

export default async function HostExploreActivitiesPage() {
  const session = await getServerSession(authOptions);
  const sessionUserId = (session?.user as any)?.id as string | undefined;
  const roles = await getEffectiveRoles(sessionUserId, (session?.user as any)?.roles);
  if (!roles.includes('HOST') && !roles.includes('ADMIN')) {
    redirect('/dashboard');
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="section-subtitle">Explorar</p>
        <h1 className="section-title">Mis actividades</h1>
      </div>
      <div className="surface-card space-y-3">
        <p className="text-sm text-slate-600">
          Aqui veras tus actividades publicadas, estado y cupos por salida.
        </p>
        <Link href="/dashboard/host/explore/new" className="pill-link">
          + Crear actividad
        </Link>
      </div>
    </div>
  );
}
