import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getEffectiveRoles } from '@/lib/server-roles';
import { PushSubscribeCard } from '@/components/push-subscribe-card';

export default async function HostNotificationsPage() {
  const session = await getServerSession(authOptions);
  const sessionUserId = (session?.user as any)?.id as string | undefined;
  const roles = await getEffectiveRoles(sessionUserId, (session?.user as any)?.roles);
  if (!roles.includes('HOST') && !roles.includes('EXPERIENCE_HOST') && !roles.includes('ADMIN')) {
    redirect('/dashboard');
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="section-subtitle">Panel Host</p>
        <h1 className="section-title">Notificaciones</h1>
      </div>
      <PushSubscribeCard
        role="host"
        title="Centro de notificaciones host"
        subtitle="Activa push para enterarte de cada consulta, mensaje, reserva y oferta."
      />
    </div>
  );
}
