import { prisma } from '@/lib/db';

export const normalizeRoles = (roles: unknown): string[] =>
  Array.from(new Set(Array.isArray(roles) ? roles.map((role) => String(role)) : []));

export async function getEffectiveRoles(userId?: string | null, sessionRoles?: unknown) {
  const currentRoles = normalizeRoles(sessionRoles);
  if (!userId) return currentRoles;

  try {
    const rows = await prisma.userRole.findMany({
      where: { userId },
      include: { role: true }
    });
    const dbRoles = rows.map((row) => row.role.name);
    return Array.from(new Set([...currentRoles, ...dbRoles]));
  } catch {
    return currentRoles;
  }
}

export async function ensureHostRole(userId: string) {
  const hostRole = await prisma.role.findUnique({ where: { name: 'HOST' } });
  if (!hostRole) return false;
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId, roleId: hostRole.id } },
    update: {},
    create: { userId, roleId: hostRole.id }
  });
  return true;
}
