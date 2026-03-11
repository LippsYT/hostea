import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getEffectiveRoles } from '@/lib/server-roles';
import { redirect } from 'next/navigation';
import { HostMessagesMenu } from '@/components/host-messages-menu';
import { HostMessageAutomationsSettings } from '@/components/host-message-automations-settings';

export default async function HostMessageAutomationsPage() {
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
        <h1 className="section-title">Mensajes</h1>
        <HostMessagesMenu active="automations" />
      </div>
      <HostMessageAutomationsSettings />
    </div>
  );
}
