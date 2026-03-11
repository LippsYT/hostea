import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireSession } from '@/lib/permissions';
import { assertCsrf } from '@/lib/csrf';
import {
  getHostMessagingConfig,
  saveHostMessagingConfig
} from '@/lib/host-messaging-config';

const quickReplySchema = z.object({
  id: z.string().trim().min(1).max(80),
  label: z.string().trim().min(1).max(80),
  body: z.string().trim().min(1).max(400)
});

const schema = z.object({
  enabled: z.boolean(),
  templates: z.object({
    inquiry: z.string().trim().min(1).max(800),
    reservationConfirmed: z.string().trim().min(1).max(800),
    preCheckIn: z.string().trim().min(1).max(800),
    welcome: z.string().trim().min(1).max(800),
    checkOut: z.string().trim().min(1).max(800)
  }),
  quickReplies: z.array(quickReplySchema).max(20),
  suspicious: z.object({
    keywords: z.array(z.string().trim().min(1).max(80)).min(1).max(30),
    autoReplyEnabled: z.boolean(),
    autoReplyMessage: z.string().trim().min(1).max(500)
  })
});

export async function GET() {
  const session = await requireSession();
  const userId = (session.user as any)?.id as string;
  const roles = (session.user as any)?.roles || [];
  if (!roles.includes('HOST') && !roles.includes('EXPERIENCE_HOST') && !roles.includes('ADMIN')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }
  const config = await getHostMessagingConfig(userId);
  return NextResponse.json({ config });
}

export async function POST(req: Request) {
  assertCsrf(req);
  const session = await requireSession();
  const userId = (session.user as any)?.id as string;
  const roles = (session.user as any)?.roles || [];
  if (!roles.includes('HOST') && !roles.includes('EXPERIENCE_HOST') && !roles.includes('ADMIN')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos invalidos' }, { status: 400 });
  }

  const config = await saveHostMessagingConfig(userId, parsed.data);
  return NextResponse.json({ ok: true, config });
}
