import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getEffectiveRoles, ensureExperienceHostRole } from '@/lib/server-roles';
import { redirect } from 'next/navigation';

const EXPERIENCE_ALLOWED_ROLES = ['ADMIN', 'HOST', 'EXPERIENCE_HOST'];

export async function requireExperienceHostAccess() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) {
    redirect('/auth/sign-in');
  }

  let roles = await getEffectiveRoles(userId, (session?.user as any)?.roles);
  if (!roles.some((role) => EXPERIENCE_ALLOWED_ROLES.includes(role))) {
    const promoted = await ensureExperienceHostRole(userId);
    if (promoted) {
      roles = await getEffectiveRoles(userId, roles);
    }
  }

  if (!roles.some((role) => EXPERIENCE_ALLOWED_ROLES.includes(role))) {
    redirect('/dashboard');
  }

  return { session: session!, userId, roles };
}
