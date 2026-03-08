import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import bcrypt from 'bcryptjs';
import { assertCsrf } from '@/lib/csrf';
import { rateLimit } from '@/lib/rate-limit';
import { RoleName } from '@prisma/client';
import { getAppBaseUrl, getSupabasePublicServerClient } from '@/lib/supabase-public';
import { verifyTurnstileToken } from '@/lib/captcha';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(2),
  captchaToken: z.string().optional(),
  legalAcceptance: z.object({
    terms: z.literal(true),
    privacy: z.literal(true),
    liability: z.literal(true)
  })
});

const getRequestIp = (req: Request) => {
  const forwardedFor = req.headers.get('x-forwarded-for') || '';
  return forwardedFor.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown';
};

export async function POST(req: Request) {
  try {
    assertCsrf(req);
    const ip = getRequestIp(req);
    const ok = await rateLimit(`auth:register:${ip}`, 5, 60);
    if (!ok) {
      return NextResponse.json({ error: 'Rate limit' }, { status: 429 });
    }
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Datos invalidos' }, { status: 400 });
    }
    const { email, password, name, captchaToken } = parsed.data;

    const captcha = await verifyTurnstileToken(captchaToken, ip);
    if (!captcha.ok) {
      return NextResponse.json({ error: captcha.reason || 'Captcha invalido' }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing?.emailVerified) {
      return NextResponse.json({ error: 'Email ya registrado' }, { status: 409 });
    }

    const supabase = getSupabasePublicServerClient();
    const emailRedirectTo = `${getAppBaseUrl(req)}/auth/callback`;
    const { error: supabaseError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo
      }
    });
    if (supabaseError) {
      console.error('supabase-signup-error', { email, message: supabaseError.message });
      if (/already registered|already exists/i.test(supabaseError.message)) {
        return NextResponse.json(
          { error: 'Ese email ya esta registrado. Si no confirmaste, usa reenviar correo.' },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: `No se pudo enviar el correo de confirmacion: ${supabaseError.message}` },
        { status: 400 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 10);
    let user = existing;
    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          passwordHash,
          emailVerified: null,
          profile: { create: { name } }
        }
      });
    } else {
      if (user.emailVerified) {
        return NextResponse.json({ error: 'Email ya registrado' }, { status: 409 });
      }
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          passwordHash,
          profile: {
            upsert: {
              create: { name },
              update: { name }
            }
          }
        }
      });
    }

    const userAgent = req.headers.get('user-agent') || 'unknown';
    const legalVersion = '2026-02-25';
    const guestRole = await prisma.role.upsert({
      where: { name: RoleName.GUEST },
      update: {},
      create: { name: RoleName.GUEST, description: 'GUEST role' }
    });
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: user.id, roleId: guestRole.id } },
      update: {},
      create: { userId: user.id, roleId: guestRole.id }
    });

    await prisma.legalAcceptance.upsert({
      where: { userId_version: { userId: user.id, version: legalVersion } },
      update: {
        termsAccepted: true,
        privacyAccepted: true,
        liabilityAccepted: true,
        ipAddress: ip,
        userAgent,
        acceptedAt: new Date()
      },
      create: {
        userId: user.id,
        version: legalVersion,
        termsAccepted: true,
        privacyAccepted: true,
        liabilityAccepted: true,
        ipAddress: ip,
        userAgent
      }
    });
    await prisma.settings.upsert({
      where: { key: `legalAcceptance:${user.id}` },
      update: {
        value: {
          version: legalVersion,
          acceptedAt: new Date().toISOString(),
          ip,
          userAgent,
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
          userAgent,
          terms: true,
          privacy: true,
          liability: true
        }
      }
    });

    return NextResponse.json({
      id: user.id,
      email: user.email,
      pendingConfirmation: true,
      message: 'Te enviamos un correo para confirmar tu cuenta.'
    });
  } catch (error: any) {
    console.error('register-error', error);
    return NextResponse.json({ error: error.message || 'Error' }, { status: 500 });
  }
}
