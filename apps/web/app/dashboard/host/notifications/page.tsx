import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { HostNotificationsCenter } from '@/components/host-notifications-center';

export default async function HostNotificationsPage() {
  const session = await getServerSession(authOptions);
  const roles = (((session?.user as any)?.roles || []) as string[]);
  if (!roles.includes('HOST') && !roles.includes('ADMIN')) {
    redirect('/dashboard');
  }

  return <HostNotificationsCenter />;
}

