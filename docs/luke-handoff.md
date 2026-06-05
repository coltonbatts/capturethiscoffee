# Luke staff login — handoff

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

## Supabase dashboard (your checklist)

- [x] RLS migration `harden_rls_and_set_updated_at` applied on project `lehwhehssjfudyrtljus`
- [x] Luke user created with `app_metadata.staff: true`
- [ ] Apply storage migration `add_person_photo_storage` so staff can upload to `person-photos`
- [ ] **Disable public sign-ups**: Authentication → Providers → Email → turn off “Allow new users to sign up”

## Add more staff later

1. Supabase → **Authentication → Users → Add user**
2. Set **App Metadata** to `{ "staff": true }`
3. Or run `node scripts/create-staff-user.mjs` with `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`

Users must sign out and back in after `app_metadata` changes.
