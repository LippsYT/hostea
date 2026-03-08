import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';

const required = (name: string) => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing env var: ${name}`);
  }
  return value;
};

async function main() {
  const supabaseUrl = required('SUPABASE_URL');
  const serviceRoleKey = required('SUPABASE_SERVICE_ROLE_KEY');
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'hostea';
  const objectPath = process.env.SUPABASE_AUTH_LOGO_PATH || 'brand/hostea-logo.jpeg';
  const localFile =
    process.env.SUPABASE_AUTH_LOGO_FILE || resolve('apps/web/public/brand/hostea-logo.jpeg');

  const file = await readFile(localFile);
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const { error: uploadError } = await supabase.storage.from(bucket).upload(objectPath, file, {
    upsert: true,
    contentType: 'image/jpeg',
    cacheControl: '3600'
  });

  if (uploadError) {
    throw new Error(`Upload failed: ${uploadError.message}`);
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(objectPath);
  const url = data.publicUrl;

  // Email-safe HTML block for Supabase auth template
  const html = `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
  <tr>
    <td align="center" style="padding:24px 0 16px 0;">
      <img src="${url}" alt="Hostea" width="120" style="display:block;border:0;outline:none;text-decoration:none;height:auto;" />
    </td>
  </tr>
</table>
`.trim();

  console.log('\n[OK] Logo uploaded.');
  console.log(`[PUBLIC URL] ${url}`);
  console.log('\n[EMAIL HTML BLOCK]');
  console.log(html);
  console.log(
    '\nPaste this in Supabase Dashboard -> Authentication -> Email Templates -> Confirm signup.'
  );
}

main().catch((error) => {
  console.error('[ERROR]', error instanceof Error ? error.message : error);
  process.exit(1);
});

