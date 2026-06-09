# Luke login handoff

Send Luke this information (use a secure channel; do not post the password in Slack threads long-term).

## Sign-in

| Field | Value |
|-------|--------|
| **Login URL** | `https://YOUR_DEPLOYED_APP_URL/login` (replace with your Vercel/production URL) |
| **Email** | `luke@capturethis.com` |
| **Temporary password** | See `docs/luke-handoff.local.md` (gitignored) or the password you set in Supabase |

After first sign-in, Luke should change his password when password reset is enabled, or you can set a new password in **Supabase → Authentication → Users**.

## What Luke can do

- **Clients** (`/clients`) — brand / advertiser records
- **People** (`/people`) — crew, agency, contacts, and person photo uploads
- **New shoot** (`/productions/new`) — create productions and rosters
- **Runner dashboard** (`/productions/[id]`) — day-of coffee workflow, including quick-add people with photos

## Verify (Luke or you)

1. Open the deployed app `/login` (not local demo mode without Supabase env vars).
2. Sign in with the credentials above.
3. Open **Clients** and **People** — lists should load without errors.
4. Create a test client and person; upload a photo; refresh — data and the photo should persist.
5. Create a production and open its runner page.
6. Open **Labels** (`/labels`), queue or print a test label, then verify the
   print-station laptop can open `/labels/station` and see queued jobs.

## Supabase dashboard (your checklist)

- [x] RLS migration `harden_rls_and_set_updated_at` applied on project `lehwhehssjfudyrtljus`
- [x] Luke's Supabase user has admin access set in `app_metadata`:
  `{"admin": true}`. This is required — the app proxy gates `/clients`,
  `/people`, `/labels`, and `/productions/new` to admin users only.
- [ ] Apply storage migration `add_person_photo_storage` and the shared demo
  access migration so authenticated users can upload to `person-photos`
- [ ] **Disable public sign-ups**: Authentication → Providers → Email → turn off “Allow new users to sign up”
- [ ] Apply the label print-job migration before using the remote `/labels` to
  `/labels/station` queue.

## Print station

- `/labels` is the normal label screen and browser-print fallback.
- `/labels/station` is the remote queue station for a laptop on the printer.
- The supported live-demo physical print path is still browser print or PNG
  import into the NIIMBOT desktop app.
- M2_H USB serial scripts are promising diagnostics, not a productized Luke
  workflow yet.

## Add more staff later

1. Supabase → **Authentication → Users → Add user**
2. Set a password and confirm the user if your Supabase project requires it.
3. Set `app_metadata` to `{"admin": true}` in Supabase → **Authentication → Users → Edit user → Raw app_metadata** so they can access all app routes.
