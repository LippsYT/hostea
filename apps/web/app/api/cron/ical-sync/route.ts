import { NextResponse } from 'next/server';
import { syncAllIcalFeeds } from '@/lib/ical-sync';

export const dynamic = 'force-dynamic';

const isAuthorized = (req: Request) => {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const { searchParams } = new URL(req.url);
  const tokenFromQuery = searchParams.get('token');
  const tokenFromHeader = req.headers.get('x-cron-secret');
  return tokenFromQuery === secret || tokenFromHeader === secret;
};

export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }
  const results = await syncAllIcalFeeds();
  return NextResponse.json({
    ok: true,
    totalFeeds: results.length,
    synced: results.filter((item) => item.ok).length,
    failed: results.filter((item) => !item.ok).length,
    results
  });
}

export async function POST(req: Request) {
  return GET(req);
}
