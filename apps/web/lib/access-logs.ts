import { prisma } from '@/lib/db';
import { createNotifications } from '@/lib/notifications';

const rolePriority = ['ADMIN', 'SUPPORT', 'MODERATOR', 'FINANCE', 'HOST', 'EXPERIENCE_HOST', 'CLIENT', 'GUEST'];

const pickPrimaryRole = (roles: string[]) =>
  rolePriority.find((role) => roles.includes(role)) || roles[0] || 'USER';

const normalizeIp = (raw?: string | null) => {
  if (!raw) return null;
  return raw.split(',')[0]?.trim() || null;
};

export async function recordLoginAccess({
  userId,
  roles,
  name,
  email,
  ip,
  userAgent
}: {
  userId: string;
  roles: string[];
  name?: string | null;
  email: string;
  ip?: string | null;
  userAgent?: string | null;
}) {
  const role = pickPrimaryRole(roles);
  const access = await prisma.accessLog.create({
    data: {
      userId,
      role,
      ip: normalizeIp(ip),
      userAgent: userAgent?.trim() || null
    }
  });

  const displayName = name?.trim() || email;
  const formattedDate = new Intl.DateTimeFormat('es-AR', {
    dateStyle: 'short',
    timeStyle: 'short'
  }).format(access.createdAt);

  const admins = await prisma.user.findMany({
    where: {
      roles: {
        some: {
          role: {
            name: 'ADMIN'
          }
        }
      }
    },
    select: { id: true }
  });

  await createNotifications(
    admins.map((admin) => ({
      userId: admin.id,
      kind: 'INFO',
      title: 'Nuevo acceso registrado',
      body: `Ingreso ${displayName} - ${role} - ${formattedDate}`,
      link: '/dashboard/admin'
    }))
  );

  return access;
}
