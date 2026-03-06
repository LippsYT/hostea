import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getEffectiveRoles } from '@/lib/server-roles';

export default async function DashboardRoot() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  const roles = await getEffectiveRoles(userId, (session?.user as any)?.roles);
  if (roles.includes('ADMIN')) redirect('/dashboard/admin');
  if (roles.includes('SUPPORT') || roles.includes('MODERATOR')) redirect('/dashboard/support');
  if (roles.includes('HOST')) redirect('/dashboard/host');
  redirect('/dashboard/client');
}
