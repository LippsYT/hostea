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
  const normalizedEmail = email.trim().toLowerCase();
  let user = await db.user.findUnique({
    where: { email: normalizedEmail },
    include: { roles: true }
  });

  if (!user) {
    const pending = await db.settings.findUnique({
      where: { key: `pendingEmailChange:${normalizedEmail}` }
    });
    const pendingUserId = typeof pending?.value === 'object' && pending?.value
      ? (pending.value as any).userId as string | undefined
      : undefined;

    if (pendingUserId) {
      user = await db.user.findUnique({
        where: { id: pendingUserId },
        include: { roles: true }
      });
      if (user) {
        await db.user.update({
          where: { id: user.id },
          data: {
            email: normalizedEmail,
            emailVerified: user.emailVerified || new Date()
          }
        });
        await db.settings.delete({ where: { key: `pendingEmailChange:${normalizedEmail}` } }).catch(() => undefined);
      }
    }
  }

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
