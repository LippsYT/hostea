import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireSession } from '@/lib/permissions';
import { getPushStatus, PushUserRole } from '@/lib/push-notifications';

const resolveRole = (req: Request, roles: string[]): PushUserRole => {
  const url = new URL(req.url);
  const role = url.searchParams.get('role');
  if (role === 'host' || role === 'client') return role;
  if (roles.includes('HOST') || roles.includes('ADMIN')) return 'host';
  return 'client';
};

const canUseRole = (roles: string[], role: PushUserRole) => {
  if (roles.includes('ADMIN')) return true;
  if (role === 'host') return roles.includes('HOST');
  return roles.includes('CLIENT');
};

export async function GET(req: Request) {
  try {
    const session = await requireSession();
    const userId = (session.user as any).id as string;
    const roles = (((session.user as any).roles || []) as string[]);
    const role = resolveRole(req, roles);
    if (!canUseRole(roles, role)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const [status, rows] = await Promise.all([
      getPushStatus(userId, role),
      prisma.pushSubscription.findMany({
        where: { hostId: userId, role },
        select: {
          id: true,
          endpoint: true,
          isActive: true,
          createdAt: true,
          lastSeenAt: true,
          userAgent: true
        },
        orderBy: { createdAt: 'desc' }
      })
    ]);

    return NextResponse.json({
      role,
      status,
      rows: rows.map((row) => ({
        id: row.id,
        endpoint: row.endpoint,
        isActive: row.isActive,
        createdAt: row.createdAt,
        lastSeenAt: row.lastSeenAt,
        userAgent: row.userAgent
      }))
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'No autorizado' }, { status: 401 });
  }
}
