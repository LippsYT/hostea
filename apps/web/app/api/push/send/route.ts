import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireSession } from '@/lib/permissions';
import { sendPushToUser } from '@/lib/push-notifications';

const schema = z.object({
  userId: z.string().min(1),
  role: z.enum(['host', 'client']),
  title: z.string().min(1),
  body: z.string().min(1),
  url: z.string().min(1),
  type: z.string().min(1),
  tag: z.string().optional()
});

export async function POST(req: Request) {
  try {
    const payload = schema.safeParse(await req.json());
    if (!payload.success) {
      return NextResponse.json({ error: 'Datos invalidos' }, { status: 400 });
    }

    const internalSecret = process.env.PUSH_INTERNAL_SECRET || '';
    const sentSecret = req.headers.get('x-push-secret') || '';
    let allowed = Boolean(internalSecret && sentSecret && internalSecret === sentSecret);

    if (!allowed) {
      const session = await requireSession();
      const roles = ((session.user as any).roles || []) as string[];
      allowed = roles.includes('ADMIN');
    }
    if (!allowed) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const result = await sendPushToUser(payload.data.userId, payload.data.role, payload.data);
    return NextResponse.json({ ok: true, result });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Error' }, { status: 500 });
  }
}
