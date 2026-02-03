import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function DashboardRoot() {
  const session = await getServerSession(authOptions);
  const roles = (session?.user as any)?.roles || [];
  if (roles.includes('ADMIN')) redirect('/dashboard/admin');
  if (roles.includes('SUPPORT') || roles.includes('MODERATOR')) redirect('/dashboard/support');
  if (roles.includes('HOST')) redirect('/dashboard/host');
  redirect('/dashboard/client');
}
