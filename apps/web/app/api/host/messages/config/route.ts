import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireSession } from '@/lib/permissions';
import { assertCsrf } from '@/lib/csrf';
import { getHostMessagingConfig, saveHostMessagingConfig } from '@/lib/host-messaging-config';

const quickReplySchema = z.object({
  id: z.string().trim().min(1).max(80),
  label: z.string().trim().min(1).max(80),
  body: z.string().trim().min(1).max(400),
  category: z.string().trim().min(1).max(40),
  favorite: z.boolean(),
  enabled: z.boolean()
});

const automationSchema = z.object({
  enabled: z.boolean(),
  templateId: z.string().trim().max(80).nullable()
});

const schema = z.object({
  quickReplies: z.array(quickReplySchema).max(50),
  automations: z.object({
    inquiry: automationSchema,
    reservation_confirmed: automationSchema,
    pre_checkin: automationSchema,
    post_checkout: automationSchema
  }),
  suspicious: z.object({
    keywords: z.array(z.string().trim().min(1).max(80)).min(1).max(50),
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
