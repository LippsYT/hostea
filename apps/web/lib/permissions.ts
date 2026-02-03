import { authOptions } from './auth';
import { getServerSession } from 'next-auth';
import { RoleName } from '@prisma/client';

export const requireSession = async () => {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    throw new Error('No autorizado');
  }
  return session;
};

export const hasRole = (roles: RoleName[] | string[] | undefined, role: RoleName) => {
  return roles?.includes(role) ?? false;
};

export const requireRole = async (role: RoleName) => {
  const session = await requireSession();
  const roles = (session.user as any).roles as RoleName[] | undefined;
  if (!roles || !roles.includes(role)) {
    throw new Error('Sin permisos');
  }
  return session;
};
