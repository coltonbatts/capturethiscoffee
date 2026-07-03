# Client login handoff

Send the client this information (use a secure channel; do not post the password in Slack threads long-term).

## Sign-in

| Field | Value |
|-------|--------|
| **Login URL** | `https://coffee.capturethis.com/login` |
| **Google** | **Continue with Google** on the login page (preferred) |
| **Email / password** | `operator@example.com` — password in `docs/client-login-handoff.local.md` (gitignored) or Supabase |

Every signed-in Supabase user has full app access per `src/lib/auth.ts`.
`app_metadata.admin` is historical and no longer required. Email/password users
should change their temporary password when reset is enabled, or set a new
password in Supabase.

## What the client can do

- **People** (`/people`) — crew, agency, contacts, and person photo uploads
- **New shoot** (`/productions/new`) — create productions and rosters
- **Runner dashboard** (`/productions/[id]`) — day-of coffee workflow, including quick-add people with photos
- **CTC Printer** (`mobile/`) — primary on-set label printing from the runner share link
- **Fallback exports** (`/labels`) — PNG/CSV export when the native printer app is unavailable or advanced export is needed

## Verify (client or you)

1. Open the deployed app `/login` (not local demo mode without Supabase env vars).
2. Sign in with the credentials above.
3. Open **People** — the list should load without errors.
4. Create a test person; upload a photo; refresh — data and the photo should persist.
5. Create a production and open its runner page.
6. Copy the runner link and confirm it is the link CTC Printer uses.
7. Open **Fallback exports** (`/labels`), preview a test label, then export a
   PNG or CSV only as a fallback/advanced path.

## Supabase dashboard (your checklist)

- [x] RLS migration `harden_rls_and_set_updated_at` applied on project `lehwhehssjfudyrtljus`
- [x] The client Supabase user exists. Full app access is based on being signed
  in; `app_metadata.admin` is no longer required.
- [ ] Apply storage migration `add_person_photo_storage` and the shared demo
  access migration so authenticated users can upload to `person-photos`
- [ ] **Disable public sign-ups**: Authentication → Providers → Email → turn off “Allow new users to sign up”
## Label printing

- CTC Printer is the normal on-set label path.
- The PA opens the same runner share link in CTC Printer, connects the NIIMBOT
  M2_H, prints pending labels, and the app marks `label_printed`.
- `/labels` exports print-ready PNG and CSV files as fallback/advanced export.
- The current 50mm x 30mm / 300 DPI preset still needs physical stock/import
  verification before being treated as final.

## Add more staff later

1. Supabase → **Authentication → Users → Add user**
2. Set a password and confirm the user if your Supabase project requires it.
3. Keep public sign-ups disabled unless intentionally onboarding new staff.
