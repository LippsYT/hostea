import { NextResponse } from 'next/server';
import { getCsrfToken } from '@/lib/csrf';

export async function GET() {
  const token = getCsrfToken();
  return NextResponse.json({ token });
}
