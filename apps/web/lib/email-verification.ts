import { RoleName } from '@prisma/client';
import { prisma } from '@/lib/db';

export const getUserEmailVerification = async (userId: string, db = prisma) => {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, emailVerified: true }
  });
  return user;
};

export const ensureUserCanPublish = async (userId: string, db = prisma) => {
  const user = await getUserEmailVerification(userId, db);
  if (!user) {
    return { ok: false as const, status: 401, error: 'Usuario no encontrado' };
  }
  if (!user.emailVerified) {
    return {
      ok: false as const,
      status: 403,
      error: 'Debes confirmar tu email para publicar.'
    };
  }
  return { ok: true as const, user };
};

const ensureRole = async (name: RoleName, db = prisma) =>
  db.role.upsert({
    where: { name },
    update: {},
    create: { name, description: `${name} role` }
  });

export const markEmailAsVerified = async (email: string, db = prisma) => {
  const user = await db.user.findUnique({
    where: { email },
    include: { roles: true }
  });
  if (!user) return null;

  const now = new Date();
  await db.user.update({
    where: { id: user.id },
    data: { emailVerified: user.emailVerified || now }
  });

  const clientRole = await ensureRole(RoleName.CLIENT, db);
  await db.userRole.upsert({
    where: { userId_roleId: { userId: user.id, roleId: clientRole.id } },
    update: {},
    create: { userId: user.id, roleId: clientRole.id }
  });

  return user.id;
};
