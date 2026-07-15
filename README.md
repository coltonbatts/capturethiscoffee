# Capture This Coffee

Mobile-first coffee runner app for Capture This production shoots. Put today's people in the roster, collect their drinks, print their labels. Built for fast scanning on set—not internal ops docs.

## Design

The UI is intentionally minimal and contemporary:

- **Rounded surfaces** — panels, inputs, buttons, and chips use `rounded-xl` / `rounded-2xl` (print labels stay sharp)
- **Calm typography** — Geist Sans for UI; sentence case; one clear title per screen
- **Name-first runner cards** — people names and production names wrap instead of truncating, with role/status/drink details kept secondary for fast scanning on set
- **Short copy** — no eyebrow kickers, demo banners, or Supabase jargon in normal use; labels and actions only where they prevent mistakes
- **Black / white / zinc** — brand mark via `CaptureMark` (`src/components/capture-mark.tsx`); shared tokens in `src/components/ui.tsx`

When adding screens, extend `Panel`, `cardClass`, `inputClass`, and button classes rather than one-off styles.

## What is in this MVP

- Private demo login at `/login` when auth is enabled
- Shoot-day list at `/productions`
- Day creation at `/productions/new` (optional client/brand name for label branding)
- Runner dashboard at `/run/[id]?token=…`
- People at `/people`
- Supabase Auth email/password when env vars are configured
- Explicit local seeded `localStorage` demo mode with `NEXT_PUBLIC_ENABLE_AUTH=false`
- Supabase schema and RLS in `supabase/schema.sql`
- Drink-collection progress ("12 of 20 drinks in") and printed-label state on the day board
- Clean mobile roster cards with full person names, compact status badges, and consistent order-management actions
- Native iOS printer app in `mobile/` — the primary on-set path for direct BLE
  printing to NIIMBOT M2_H
- Batch NIIMBOT PNG and CSV export from `/labels` (whole day preselected; unprinted quick-select)

## Day-of resilience

The day-of flow is hardened so a single failure never strands the runner
mid-shoot:

- Network or Supabase failures surface a plain "No connection — check Wi-Fi or
  signal, then try again" message instead of raw fetch errors, and the runner
  dashboard and `/labels` workstation both have a **Try again** retry when the
  initial load fails.
- Order taps on the day board are optimistic: the change shows immediately,
  and a failed save rolls back just that one order with an error toast.
- CTC Printer is the primary print path. `/labels` remains available for
  fallback PNG/CSV export; if native phone sharing is not available, the normal
  Download PNG action remains available.
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
   - **Setup writes require sign-in** — creating or editing clients, people,
     productions, rosters, and new order drafts requires any signed-in Supabase
     user (since `20260703120000_authenticated_full_access.sql`; admin
     app_metadata is no longer required).
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
8. For Google sign-in (`/login` → **Continue with Google**), open **Authentication > Providers > Google**, enable it, and paste a Google Cloud OAuth **Web application** client ID and secret. In Google Cloud, set the authorized redirect URI to `https://<project-ref>.supabase.co/auth/v1/callback` (find `<project-ref>` in your Supabase project URL). In Supabase **Authentication > URL Configuration**, set **Site URL** to your deployed app origin and add redirect URLs for local and production (for example `http://localhost:3000/**` and `https://coffee.capturethis.com/**`).
9. For a controlled demo, disable public sign-ups or leave sign-ups unused and create demo users manually.

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

Create users in the Supabase dashboard (email/password) or have them sign in once with Google:

1. Go to **Authentication > Users**.
2. For email/password: click **Add user**, enter an email, set a password, and confirm the user if your project requires it. For Google: sign in at `/login` once, then find the new user in this list.

That's it — any signed-in user has full access (no app_metadata needed). Access
control is invitation-based: keep public sign-ups disabled so only people you
add can get in.

Runners do not need an account for the day-of flow, but they do need a
production share link. Anonymous visitors cannot read crew/order tables directly
or update orders directly through Supabase. Use the **Copy runner link** button
on a production board, or generate a share token in SQL:

```sql
select public.create_production_share_token(
  '00000000-0000-0000-0000-000000000000'::uuid,
  now() + interval '14 days',
  'Shoot day runner link'
);
```

Open `/run/<production-id>?token=<returned-token>` for the runner view. Legacy
`/productions/<production-id>?token=…` links redirect during migration.
The token authorizes only that production. It omits private person notes and
dietary notes. It does include `usual_order` because the runner screen uses it
as the operational prompt for confirming drinks quickly. Order edits are limited
to operational drink/status fields on active productions.
Keep public sign-ups disabled so only invited users can be created.

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
App experience map: [docs/app-experience-map.md](docs/app-experience-map.md).
Client onboarding checklist: [docs/client-login-handoff.md](docs/client-login-handoff.md).
Paid V1 readiness checklist: [docs/v1-readiness.md](docs/v1-readiness.md).
Fallback label export workflow: [docs/label-image-export.md](docs/label-image-export.md).

## Label printing

Capture This Coffee generates branded 50×30mm cup labels. The **primary on-set path** is the native **CTC Printer** iOS app (`mobile/`): it pulls a label queue from the web API, downloads server-rendered PNGs, prints over Bluetooth LE to the NIIMBOT M2_H, and marks `label_printed` on each order.

### CTC Printer app (recommended on set)

1. Deploy or run this Next.js app with `SUPABASE_SERVICE_ROLE_KEY` set (required for public API routes).
2. Set the production to **active** (required before `label_printed` updates stick).
3. Generate a runner share link (SQL below) and open it on the phone, or paste the full URL into CTC Printer.
4. In **CTC Printer**: link production → connect printer → tap **Print** per label.
5. Force-quit the official NIIMBOT app before connecting — it holds the BLE connection.

Setup, signing, and troubleshooting: [mobile/README.md](mobile/README.md).  
Strategy and hardware notes: [docs/phone-printing-investigation.md](docs/phone-printing-investigation.md).

**Local dev on a physical iPhone:** use your Mac's LAN IP in the share URL, not `localhost` (e.g. `http://192.168.1.69:3000/run/{id}?token=…`).

### Public printer API (share-token auth)

Same token as the runner board — no separate auth system.

| Endpoint | Purpose |
|---|---|
| `GET /api/public/productions/{id}/labels?token=…` | Label queue JSON for on-set roster |
| `GET /api/public/orders/{orderId}/label?productionId=…&token=…` | Server-rendered PNG (`production-sticker-sheet` design) |
| `PATCH /api/public/orders/{orderId}` | Body: `{ "productionId", "token", "patch": { "label_printed": true } }` |

PNG rendering uses the same drawing code as `/labels`, via `@napi-rs/canvas` on the server (`src/lib/niimbot-m2-export-server.ts`).

### Fallback: `/labels` + NIIMBOT app

The web `/labels` screen still supports PNG share/download and NIIMBOT batch CSV for bulk export or when the native app is unavailable:

1. Open `/labels` on the phone.
2. Choose the production and labels.
3. **Share** or **Download PNG**.
4. Import in the NIIMBOT first-party app and print.

The current assumed export preset is 50mm × 30mm at 300 DPI (`591×354px`). Physical roll verification is still pending — see [docs/label-image-export.md](docs/label-image-export.md).

The browser never uses the service role key — it uses only
`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and table/photo
access is controlled by Supabase Auth plus RLS/storage policies.

## Seed data

The app does not automatically insert demo rows into Supabase. To test against Supabase, add a client and people from the app, then create a production. To prefill sample rows, adapt the records in `src/lib/seed.ts` into SQL inserts using Supabase-generated UUIDs.

## Verification

```bash
npm run lint
npm test
npm run build
```

The iOS printer app:

```bash
cd mobile && flutter analyze && flutter test
```
