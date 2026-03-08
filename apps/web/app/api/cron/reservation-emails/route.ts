import { NextRequest, NextResponse } from 'next/server';
import { runReservationLifecycleEmailAutomation } from '@/lib/reservation-emails';

const isAuthorized = (req: NextRequest) => {
  const token = req.headers.get('x-cron-token') || req.nextUrl.searchParams.get('token');
  const expected = process.env.CRON_SECRET || '';
  return expected.length > 0 && token === expected;
};

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }
  const result = await runReservationLifecycleEmailAutomation();
  return NextResponse.json({ ok: true, ...result });
}

export async function GET(req: NextRequest) {
  return POST(req);
}
