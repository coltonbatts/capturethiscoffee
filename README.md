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
- Copyable coffee summaries and browser-printable M2 label cards
- Remote label queue from `/labels` to `/labels/station` when Supabase print-job migrations are applied
- NIIMBOT M2_H direct USB serial diagnostics and early bitmap print tests

## Day-of resilience

The day-of flow is hardened so a single failure never strands the runner
mid-shoot:

- Network or Supabase failures surface a plain "No connection — check Wi-Fi or
  signal, then try again" message instead of raw fetch errors, and the runner
  dashboard and `/labels` workstation both have a **Try again** retry when the
  initial load fails.
- Status taps on the dashboard are optimistic: the change shows immediately,
  and a failed save rolls back just that one order with an error toast.
- On `/labels`, a failed order save warns but **still prints the physical
  label** from local state; queue failures remind you the remote queue is
  optional and browser print keeps working.
- `/labels/station` keeps showing the last loaded queue when a background
  refresh fails ("Connection lost… retrying automatically"), print-attempt
  bookkeeping is best-effort and can never block printing or releasing a job,
  and a USB print timeout returns a clear message pointing at the browser
  print / PNG fallbacks.
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
   - **Active event-day data is publicly readable** — anyone with the link can
     read active productions, people, and orders.
   - **Setup writes require an admin** — creating or editing clients, people,
     productions, rosters, and new order drafts requires a signed-in user with
     `app_metadata.admin = true` (`staff`/`role` are also accepted; see
     `src/lib/auth.ts`).
   - **Live order updates stay open** — runners can update an existing order's
     status and drink on an active production without signing in.
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
- `production_roster`
- `orders`
- `printer_devices`
- `label_print_jobs`
- `label_print_attempts`
- Supabase Storage bucket `person-photos` for authenticated people photos

When `NEXT_PUBLIC_ENABLE_AUTH=false`, the app uses seeded demo data in `localStorage`. That mode is local-only: data entered there is not written to Supabase and will not be visible to other users or devices. A reset-to-seed control lives on the labels screen and only rewrites this browser's local data — in Supabase-backed mode it does not touch shared data and should be treated as a local-only affordance.

If auth is enabled or unset but either Supabase env var is missing, the app shows a configuration error instead of falling back to localStorage.

## Demo users

Create demo users in the Supabase dashboard:

1. Go to **Authentication > Users**.
2. Click **Add user**.
3. Enter a demo user email, for example owner `luke@capturethis.com`.
4. Set a password and confirm the user if your project requires it.
5. Set the user's **Raw app_metadata** to `{"admin": true}`. This is required for
   anyone who needs to create or edit clients, people, productions, rosters, or
   new order drafts — including Luke. Without it, the user can sign in and read
   data but every setup write fails with "Admin access required," and the app
   proxy redirects them away from `/people`, `/clients`, `/labels`, and
   `/productions/new`.

Runners do not need an account for the day-of flow: anonymous visitors can read
active productions and update an existing order's status and drink on an active
production. They cannot create records or reach the admin/setup routes above.
Keep public sign-ups disabled so only invited admins can be created.

Then open `/login`, sign in, and continue to `/productions`.

Luke onboarding checklist: [docs/luke-handoff.md](docs/luke-handoff.md).
Paid V1 readiness checklist: [docs/v1-readiness.md](docs/v1-readiness.md).
NIIMBOT label station setup: [docs/label-printer-station.md](docs/label-printer-station.md).

## Label printing

Capture This Coffee uses a master queue plus local printer stations.
`coffee.capturethis.com` owns productions, orders, label payloads, queue state,
and print history. Physical printing happens only on a local station running on
the laptop connected to the NIIMBOT.

Use `/labels` to print a selected order through the browser fallback or queue it
for a station. Open `/labels/station` from `http://localhost:3000` on the
printer laptop to claim queued jobs and print through local USB serial. Browser
print and 300 DPI PNG download remain fallbacks.

Do not configure NIIMBOT serial numbers in the master website. Each station
selects its own local printer device path, for example
`LABEL_SERIAL_PORT=/dev/cu.usbmodem83201`.

## NIIMBOT direct USB diagnostics

The current confirmed low-level NIIMBOT M2_H path is local USB serial, not CUPS.
The tested printer exposes `/dev/cu.usbmodem*` on macOS with USB vendor/product
`0x3513 / 0x0002`.

Safe status checks:

```bash
npm run niimbot:probe
npm run niimbot:status
```

One-label print diagnostics, requiring explicit confirmation:

```bash
npm run niimbot:print-diagnostic -- --yes /dev/cu.usbmodem101
npm run niimbot:print-glyph-test -- --yes /dev/cu.usbmodem101
```

Use the detected `/dev/cu.usbmodem*` path if it changes after reconnecting the
printer. The glyph test is still a deterministic calibration step; confirm
physical orientation and readability before moving to app-rendered labels.

The browser never uses the service role key — it uses only
`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and table/photo
access is controlled by Supabase Auth plus RLS/storage policies.

The trusted **label-queue** server routes are the exception: when an order is
saved, the app reconciles its label print job through a server route that uses
`SUPABASE_SERVICE_ROLE_KEY` (see `src/lib/supabase-server.ts`). This key is
required only for the remote `/labels` → `/labels/station` queue. If it is unset,
label-queue reconciliation is skipped and **order saves still succeed** — the
queue handoff is simply unavailable until the key is configured.

## Seed data

The app does not automatically insert demo rows into Supabase. To test against Supabase, add a client and people from the app, then create a production. To prefill sample rows, adapt the records in `src/lib/seed.ts` into SQL inserts using Supabase-generated UUIDs.

## Verification

```bash
npm run lint
npm run build
```
