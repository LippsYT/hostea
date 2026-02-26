import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import bcrypt from 'bcryptjs';
import { assertCsrf } from '@/lib/csrf';
import { rateLimit } from '@/lib/rate-limit';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(2),
  legalAcceptance: z.object({
    terms: z.literal(true),
    privacy: z.literal(true),
    liability: z.literal(true)
  })
});

export async function POST(req: Request) {
  try {
    assertCsrf(req);
    const ok = await rateLimit('auth:register', 5, 60);
    if (!ok) {
      return NextResponse.json({ error: 'Rate limit' }, { status: 429 });
    }
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Datos invalidos' }, { status: 400 });
    }
    const { email, password, name } = parsed.data;
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: 'Email ya registrado' }, { status: 409 });
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        profile: { create: { name } }
      }
    });
    const role = await prisma.role.findUnique({ where: { name: 'CLIENT' } });
    if (role) {
      await prisma.userRole.create({ data: { userId: user.id, roleId: role.id } });
    }

    const forwardedFor = req.headers.get('x-forwarded-for') || '';
    const ip = forwardedFor.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown';
    const legalVersion = '2026-02-25';
    await prisma.settings.upsert({
      where: { key: `legalAcceptance:${user.id}` },
      update: {
        value: {
          version: legalVersion,
          acceptedAt: new Date().toISOString(),
          ip,
          terms: true,
          privacy: true,
          liability: true
        }
      },
      create: {
        key: `legalAcceptance:${user.id}`,
        value: {
          version: legalVersion,
          acceptedAt: new Date().toISOString(),
          ip,
          terms: true,
          privacy: true,
          liability: true
        }
      }
    });

    return NextResponse.json({ id: user.id, email: user.email });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Error' }, { status: 500 });
  }
}
