# Supabase Auth email logo (public storage URL)

This project now includes a helper script to upload the auth logo to a **public** Supabase Storage bucket and produce an email-safe HTML `<img>` block.

## 1) Upload logo to public bucket

Set env vars (already documented in `.env.example`):

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_STORAGE_BUCKET` (default: `hostea`)
- `SUPABASE_AUTH_LOGO_PATH` (default: `brand/hostea-logo.jpeg`)
- `SUPABASE_AUTH_LOGO_FILE` (default: `apps/web/public/brand/hostea-logo.jpeg`)

Run:

```bash
npm run auth:email-logo:upload
```

The command prints:

- the final **public storage URL**
- an email-safe HTML block with the `<img src="...">` set to that URL

## 2) Update Supabase email template

In Supabase Dashboard:

`Authentication -> Email Templates -> Confirm signup`

Paste the HTML block from the script output or use:

`supabase/auth/confirm-signup-template.html`

and replace the image `src` with your real public URL.

## Important

- Do **not** use app-domain image URLs in Supabase auth emails.
- Use direct public Storage URL only:
  `https://<project-ref>.supabase.co/storage/v1/object/public/<bucket>/<path>`
