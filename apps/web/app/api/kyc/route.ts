import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireSession } from '@/lib/permissions';
import { assertCsrf } from '@/lib/csrf';
import { z } from 'zod';
import { rateLimit } from '@/lib/rate-limit';

const schema = z.object({
  docFrontUrl: z.string().url(),
  docBackUrl: z.string().url().optional(),
  selfieUrl: z.string().url().optional()
});

export async function POST(req: Request) {
  assertCsrf(req);
  const session = await requireSession();
  const ok = await rateLimit(`kyc:${(session.user as any).id}`, 5, 3600);
  if (!ok) return NextResponse.json({ error: 'Rate limit' }, { status: 429 });
  const body = await req.json();
  if (body.docBackUrl == '') body.docBackUrl = undefined;
  if (body.selfieUrl == '') body.selfieUrl = undefined;
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Datos invalidos' }, { status: 400 });

  const submission = await prisma.kycSubmission.create({
    data: {
      userId: (session.user as any).id,
      docFrontUrl: parsed.data.docFrontUrl,
      docBackUrl: parsed.data.docBackUrl || undefined,
      selfieUrl: parsed.data.selfieUrl || undefined
    }
  });

  return NextResponse.json({ submission });
}
