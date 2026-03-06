import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { HostOnboarding } from '@/components/host-onboarding';
import { ensureHostRole } from '@/lib/server-roles';

export default async function HostOnboardingPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect('/auth/sign-in');
  }

  const userId = (session.user as any).id as string;
  const roles = (((session.user as any).roles || []) as string[]);

  if (!roles.includes('HOST') && !roles.includes('ADMIN')) {
    await ensureHostRole(userId);
  }

  return <HostOnboarding />;
}
