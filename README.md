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

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

The app redirects `/` to `/productions`.

## Supabase setup

1. Create a Supabase project.
2. Run `supabase/schema.sql` in the Supabase SQL editor. This enables RLS and allows only authenticated users to read and write app tables.
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

When `NEXT_PUBLIC_ENABLE_AUTH=false`, the app uses seeded demo data in `localStorage`. That mode is local-only: data entered there is not written to Supabase and will not be visible to other users or devices. A reset control is available on the productions list in that mode only (no in-app demo messaging).

If auth is enabled or unset but either Supabase env var is missing, the app shows a configuration error instead of falling back to localStorage.

## Demo users

Create demo users in the Supabase dashboard:

1. Go to **Authentication > Users**.
2. Click **Add user**.
3. Enter a demo user email, for example `runner@capturethis.com` or owner `luke@capturethis.com`.
4. Set a password and confirm the user if your project requires it.
5. No app metadata is required for the private demo. Any authenticated user can read and write the shared Supabase data.

Anonymous users cannot read or write app tables (RLS). Keep public sign-ups disabled if only invited demo users should access production data.

Then open `/login`, sign in, and continue to `/productions`.

Luke onboarding checklist: [docs/luke-handoff.md](docs/luke-handoff.md).
Paid V1 readiness checklist: [docs/v1-readiness.md](docs/v1-readiness.md).
NIIMBOT label station setup: [docs/label-printer-station.md](docs/label-printer-station.md).

## Label printing

The supported live-demo path is browser print. Use `/labels` to print selected
orders directly, or queue selected labels to the remote station at
`/labels/station` when Supabase auth and the print-job migration are enabled.
The station can claim queued jobs, render the same 50mm x 30mm labels, print
through the browser dialog, download a PNG for the NIIMBOT desktop app, and mark
jobs printed only after physical confirmation.

The M2_H USB serial scripts show real progress toward direct local printing, but
they are diagnostics/spikes rather than the productized demo path. Do not promise
automatic USB printing to demo staff yet.

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

The app does not use the service role key. The browser uses only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`; table and photo upload access are controlled by Supabase Auth plus RLS/storage policies.

## Seed data

The app does not automatically insert demo rows into Supabase. To test against Supabase, add a client and people from the app, then create a production. To prefill sample rows, adapt the records in `src/lib/seed.ts` into SQL inserts using Supabase-generated UUIDs.

## Verification

```bash
npm run lint
npm run build
```
