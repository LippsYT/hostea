import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { HostOnboarding } from '@/components/host-onboarding';
import { prisma } from '@/lib/db';

export default async function HostOnboardingPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect('/auth/sign-in');
  }

  const userId = (session.user as any).id as string;
  const roles = (((session.user as any).roles || []) as string[]);

  if (!roles.includes('HOST') && !roles.includes('ADMIN')) {
    const hostRole = await prisma.role.findUnique({ where: { name: 'HOST' } });
    if (hostRole) {
      await prisma.userRole.upsert({
        where: { userId_roleId: { userId, roleId: hostRole.id } },
        update: {},
        create: { userId, roleId: hostRole.id }
      });
    }
  }

  return <HostOnboarding />;
}
