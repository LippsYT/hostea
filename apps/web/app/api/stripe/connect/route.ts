import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireSession } from '@/lib/permissions';
import { assertCsrf } from '@/lib/csrf';
import { stripe } from '@/lib/stripe';

export async function POST(req: Request) {
  assertCsrf(req);
  const session = await requireSession();
  const roles = (session.user as any).roles as string[];
  if (!roles.includes('HOST') && !roles.includes('ADMIN')) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
  }
  if (process.env.ENABLE_STRIPE_CONNECT !== 'true') {
    return NextResponse.json({ error: 'Stripe Connect deshabilitado' }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: (session.user as any).id } });
  if (!user) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });

  let accountId = user.stripeAccountId;
  if (!accountId) {
    const account = await stripe.accounts.create({
      type: 'express',
      email: user.email
    });
    accountId = account.id;
    await prisma.user.update({ where: { id: user.id }, data: { stripeAccountId: accountId } });
  }

  const link = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${process.env.APP_URL}/dashboard/host`,
    return_url: `${process.env.APP_URL}/dashboard/host`,
    type: 'account_onboarding'
  });

  return NextResponse.json({ url: link.url });
}
