# Capture This Coffee

Mobile-first coffee runner app for Capture This production shoots. Built for fast scanning on set—not internal ops docs.

## Design

The UI is intentionally minimal and contemporary:

- **Rounded surfaces** — panels, inputs, buttons, and chips use `rounded-xl` / `rounded-2xl` (print labels stay sharp)
- **Calm typography** — Geist Sans for UI; sentence case; one clear title per screen
- **Short copy** — no eyebrow kickers, demo banners, or Supabase jargon in normal use; labels and actions only where they prevent mistakes
- **Black / white / zinc** — brand mark via `CaptureMark` (`src/components/capture-mark.tsx`); shared tokens in `src/components/ui.tsx`

When adding screens, extend `Panel`, `cardClass`, `inputClass`, and button classes rather than one-off styles.

## What is in this MVP

- Private demo login at `/login` when auth is enabled
- Production list at `/productions`
- Production creation at `/productions/new`
- Runner dashboard at `/productions/[id]`
- People at `/people`
- Clients at `/clients`
- Supabase Auth email/password when env vars are configured
- Explicit local seeded `localStorage` demo mode with `NEXT_PUBLIC_ENABLE_AUTH=false`
- Supabase schema and RLS in `supabase/schema.sql`
- Copyable coffee summaries and print-ready NIIMBOT label PNG export from `/labels`

## Day-of resilience

The day-of flow is hardened so a single failure never strands the runner
mid-shoot:

- Network or Supabase failures surface a plain "No connection — check Wi-Fi or
  signal, then try again" message instead of raw fetch errors, and the runner
  dashboard and `/labels` workstation both have a **Try again** retry when the
  initial load fails.
- Status taps on the dashboard are optimistic: the change shows immediately,
  and a failed save rolls back just that one order with an error toast.
- `/labels` keeps PNG export client-side. If native phone sharing is not
  available, the normal Download PNG action remains available.
- Missing or unreachable people photos fall back to initials instead of a
  broken image.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

The app redirects `/` to `/productions`.

## Supabase setup

1. Create a Supabase project.
2. Run `supabase/schema.sql` and then every file in `supabase/migrations` (in
   filename order) in the Supabase SQL editor. These enable RLS with the access
   model the app actually relies on:
   - **Event-day runner access is token scoped** — a production share token can
     read only that production's runner payload through the app API.
   - **Setup writes require an admin** — creating or editing clients, people,
     productions, rosters, and new order drafts requires a signed-in user with
     `app_metadata.admin = true` (`staff`/`role` are also accepted; see
     `src/lib/auth.ts`).
   - **Live order updates are token scoped** — runners can update operational
     fields on existing orders only through a valid share token for that active
     production.
3. Copy `.env.example` to `.env.local`.
4. Fill in:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

5. Set `NEXT_PUBLIC_ENABLE_AUTH=true` or leave it unset when you want sign-in and Supabase-backed data enabled.
6. Restart `npm run dev` after changing `.env.local`.
7. In Supabase, open **Authentication > Providers > Email** and confirm email/password sign-in is enabled.
8. For a controlled demo, disable public sign-ups or leave sign-ups unused and create demo users manually.

When both env vars are present and `NEXT_PUBLIC_ENABLE_AUTH=true`, the app reads and writes these Supabase tables:

- `clients`
- `people`
- `client_people`
- `productions`
- `production_share_tokens`
- `production_roster`
- `orders`
- Supabase Storage bucket `person-photos` for authenticated people photos

When `NEXT_PUBLIC_ENABLE_AUTH=false`, the app uses seeded demo data in `localStorage`. That mode is local-only: data entered there is not written to Supabase and will not be visible to other users or devices. A reset-to-seed control lives on the labels screen and only rewrites this browser's local data — in Supabase-backed mode it does not touch shared data and should be treated as a local-only affordance.

If auth is enabled or unset but either Supabase env var is missing, the app shows a configuration error instead of falling back to localStorage.

## Demo users

Create demo users in the Supabase dashboard:

1. Go to **Authentication > Users**.
2. Click **Add user**.
3. Enter a demo user email, for example owner `admin@example.com`.
4. Set a password and confirm the user if your project requires it.
5. Set the user's **Raw app_metadata** to `{"admin": true}`. This is required for
   anyone who needs to create or edit clients, people, productions, rosters, or
   new order drafts. Without it, the user can sign in and read data but every
   setup write fails with "Admin access required," and the app
   proxy redirects them away from `/people`, `/clients`, `/labels`, and
   `/productions/new`.

Runners do not need an account for the day-of flow, but they do need a
production share link. Anonymous visitors cannot read crew/order tables directly
or update orders directly through Supabase. Generate a share token as an admin:

```sql
select public.create_production_share_token(
  '00000000-0000-0000-0000-000000000000'::uuid,
  now() + interval '14 days',
  'Shoot day runner link'
);
```

Open `/productions/<production-id>?token=<returned-token>` for the runner view.
The token authorizes only that production. It omits private person notes and
dietary notes. It does include `usual_order` because the runner screen uses it
as the operational prompt for confirming drinks quickly. Order edits are limited
to operational drink/status fields on active productions.
Keep public sign-ups disabled so only invited admins can be created.

Manual RLS checks after applying migrations:

```sql
set local role anon;
select * from public.people limit 1; -- permission denied
select * from public.orders limit 1; -- permission denied
update public.orders set status = 'confirmed' where true; -- permission denied
reset role;
```

Then open `/login`, sign in, and continue to `/productions`.

Operating SOP: [docs/standard-operating-procedure.md](docs/standard-operating-procedure.md).
Client onboarding checklist: [docs/client-login-handoff.md](docs/client-login-handoff.md).
Paid V1 readiness checklist: [docs/v1-readiness.md](docs/v1-readiness.md).
Label image export workflow: [docs/label-image-export.md](docs/label-image-export.md).

## Label printing

Capture This Coffee generates a polished, print-ready PNG label. The NIIMBOT
first-party app handles printer pairing and Bluetooth printing.

The on-set workflow is:

1. Open `/labels` on the phone.
2. Choose the production and one or more active labels.
3. Preview the label.
4. Tap **Share** when supported, or **Download PNG**.
5. Open the NIIMBOT app.
6. Import the PNG and print through NIIMBOT's Bluetooth flow.

The current assumed export preset is 50mm x 30mm at 300 DPI
(`591 x 354px`). The exact lid-label media, round versus rectangular stock,
actual dimensions, and NIIMBOT app import scaling still need physical
verification before being treated as final.

The browser never uses the service role key — it uses only
`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and table/photo
access is controlled by Supabase Auth plus RLS/storage policies.

## Seed data

The app does not automatically insert demo rows into Supabase. To test against Supabase, add a client and people from the app, then create a production. To prefill sample rows, adapt the records in `src/lib/seed.ts` into SQL inserts using Supabase-generated UUIDs.

## Verification

```bash
npm run lint
npm run build
```
