import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/permissions';
import { assertCsrf } from '@/lib/csrf';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(req: Request) {
  assertCsrf(req);
  await requireSession();
  const body = await req.json();
  const { key } = body as { key: string };

  const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'hostea';
  const { data, error } = await supabaseAdmin.storage.from(bucket).createSignedUploadUrl(key);
  if (error || !data) {
    return NextResponse.json({ error: error?.message || 'No se pudo firmar upload' }, { status: 500 });
  }

  const { data: publicData } = supabaseAdmin.storage.from(bucket).getPublicUrl(key);

  return NextResponse.json({
    signedUrl: data.signedUrl,
    path: data.path,
    publicUrl: publicData.publicUrl
  });
}
