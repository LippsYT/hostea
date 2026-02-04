import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { HostOnboarding } from '@/components/host-onboarding';

export default async function HostOnboardingPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect('/auth/sign-in');
  }

  return <HostOnboarding />;
}
