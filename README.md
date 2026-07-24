# Capture This Coffee

Mobile-first coffee runner app for Capture This production shoots. Put today's people in the roster, collect their drinks, print their labels. Built for fast scanning on set—not internal ops docs.

## Printer handoff

The repository can build the web and iOS release candidates, but a green build
does **not** make the NIIMBOT handoff complete. Luke must still pass the physical
M2_H acceptance flow, demonstrate the fallback, and receive the required
account access before the printer leaves Colton's possession.

Use these documents as the handoff packet:

- [Handoff hub](docs/HANDOFF.md) — start here; role-based index, kit,
  day-of sequence, failure decisions, and definition of done
- [Luke Quick Start](docs/luke-quick-start.md) — the one-page day-of workflow
- [Physical release test](docs/physical-release-test.md) — the mandatory M2_H
  evidence and Luke acceptance record
- [Operational handoff](docs/operational-handoff.md) — ownership, inventory,
  distribution, support boundary, and cleanup
- [Release evidence](docs/release-evidence-1.0.0.md) — dated source, build, live,
  and dashboard evidence
- [TestFlight checklist](docs/testflight-checklist.md) — temporary beta
  distribution and external-pilot gates

Never put a runner token, password, service key, signing secret, or real client
data in these documents, screenshots, logs, chat, or Git.

### Smartest next steps

Complete these in order; do not substitute automated checks for the physical
gate:

1. **Deploy the reviewed release candidate.** Record the exact merged Git commit
   and deployment ID, then repeat the live boundary checks in the release
   evidence.
2. **Close the owner/dashboard batch.** An account owner must verify the Vercel
   environment names and targets; Supabase migrations, RLS, Realtime, backups,
   and public-signup setting; Apple distribution state; credential rotation;
   billing; renewals; and named ownership. Record evidence without copying
   secrets.
3. **Run one handoff session with Luke.** Luke installs/opens the supported
   build, links a fictional production, connects the exact M2_H, prints and
   verifies server sync, recovers an interrupted print without a duplicate,
   completes the `/labels` fallback, and signs the physical record.
4. **Clean up test access immediately after acceptance.** Revoke the disposable
   runner link, remove unnecessary tester/operator access, and confirm the
   evidence contains no real client data.
5. **Finish durable distribution.** TestFlight is temporary and builds expire.
   Maintain named Apple/App Store Connect owners plus a documented replacement
   build path, and complete the planned permanent unlisted App Store
   distribution so Luke is not dependent on Colton for reinstall or renewal.

## Design

The UI is intentionally minimal and contemporary:

- **Rounded surfaces** — panels, inputs, buttons, and chips use `rounded-xl` / `rounded-2xl` (print labels stay sharp)
- **Calm typography** — Geist Sans for UI; sentence case; one clear title per screen
- **Name-first runner cards** — people names and production names wrap instead of truncating, with role/status/drink details kept secondary for fast scanning on set
- **Short copy** — no eyebrow kickers, demo banners, or Supabase jargon in normal use; labels and actions only where they prevent mistakes
- **Capture yellow / warm paper / black** — the smiley leads the app icon, launch experience, and navigation lockup; shared tokens live in `src/app/globals.css` and `src/components/ui.tsx`

When adding screens, extend `Panel`, `cardClass`, `inputClass`, and button classes rather than one-off styles.

## What is in this MVP

- Operator login at `/login` through Supabase Auth
- Shoot-day list at `/productions`
- Day creation at `/productions/new` (optional client/brand name for label branding)
- Runner dashboard at `/run/[id]?token=…`
- People at `/people`
- Supabase Auth email/password with required Supabase configuration
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
- The authenticated operator board listens for Supabase Realtime order changes
  and retains a 10-second polling fallback. The public runner deliberately uses
  a 10-second token API poll and never connects directly to Supabase.

## Run locally

```bash
npm install
cp .env.example .env.local
# Fill in the required Supabase values before starting the app.
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

5. Add `SUPABASE_SERVICE_ROLE_KEY` for the token-scoped runner/printer APIs. It is server-only and must never use a `NEXT_PUBLIC_` prefix.
6. Restart `npm run dev` after changing `.env.local`.
7. In Supabase, open **Authentication > Providers > Email** and confirm email/password sign-in is enabled.
8. For Google sign-in (`/login` → **Continue with Google**), open **Authentication > Providers > Google**, enable it, and paste a Google Cloud OAuth **Web application** client ID and secret. In Google Cloud, set the authorized redirect URI to `https://<project-ref>.supabase.co/auth/v1/callback` (find `<project-ref>` in your Supabase project URL). In Supabase **Authentication > URL Configuration**, set **Site URL** to your deployed app origin and add redirect URLs for local and production (for example `http://localhost:3000/**` and `https://coffee.capturethis.com/**`).
9. Disable public sign-ups and create or invite operator users manually. Hiding
   sign-up in the Capture This UI is not sufficient; the Supabase Auth setting
   itself must reject public registration.

Supabase is the application's only runtime data backend. The authenticated operator app reads and writes these tables:

- `clients`
- `people`
- `client_people`
- `productions`
- `production_share_tokens`
- `production_roster`
- `orders`
- Supabase Storage bucket `person-photos` for authenticated people photos

Missing or malformed public Supabase configuration shows an actionable setup error. It never loads seed data, creates browser-local records, or reports a local write as successful. Local development therefore requires a configured Supabase project.

The browser still uses `localStorage` for non-authoritative UI preferences such as production list ordering and label design. Those preferences are not application records and do not synchronize across devices.

Authenticated operator table reads now run in Server Components through the
server-only domain DAL under `src/server/operator/`. Operator writes use thin
Server Actions in `src/app/operator-actions.ts`. Each read and mutation creates
an anon-key Supabase server client from the current request cookies, verifies
the signed-in user, and relies on authenticated RLS; the service role remains
exclusive to token-scoped public runner/printer Route Handlers.

The intentional browser Supabase exceptions are authentication/session
observation, the `orders` Realtime subscription used only as a refresh signal,
and authenticated `person-photos` Storage access. Photo metadata saved on a
person still crosses the operator Server Action boundary. No operator client
component performs direct table CRUD.

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

Capture This Coffee generates branded 50×30mm cup labels. The **primary on-set path** is the native **Capture This** iPhone app (`mobile/`): it pulls a label queue from the web API, downloads server-rendered PNGs, prints over Bluetooth LE to the NIIMBOT M2_H, and marks `label_printed` on each order.

### Capture This app (recommended on set)

1. Deploy or run this Next.js app with `SUPABASE_SERVICE_ROLE_KEY` set (required for public API routes).
2. Set the production to **active** (required before `label_printed` updates stick).
3. Generate a runner share link (SQL below) and open it on the phone, or paste the full URL into Capture This.
4. In **Capture This**: link production → connect printer → tap **Print** per label.
5. Force-quit the official NIIMBOT app before connecting — it holds the BLE connection.

The app stores the production session in the iOS Keychain. If the label prints
but synchronization fails, use **Sync only** instead of reprinting. Uncertain
outcomes remain blocked from batches until the operator inspects the physical
output and explicitly resolves them.

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

The browser never uses the service role key. Browser auth, Realtime
notifications, and the documented photo-storage exception use only
`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`; operator table
access executes on the server with the same anon key, signed-in cookie session,
and RLS.

## Local test data

The app does not include or automatically insert a browser-local demo database. To test locally, add a client and people through the configured Supabase-backed app, then create a production. Any reusable test fixtures should stay isolated under `tests/` and must not become a writable runtime data source.

## Verification

```bash
npm run lint
npm run test
npm run build
npm run verify:niimbot-export
npm audit --omit=dev
```

The iOS printer app:

```bash
cd mobile && flutter pub get
cd mobile && flutter test
cd mobile && flutter analyze
cd mobile && flutter build ipa --release --export-options-plist=ios/ExportOptions.plist
```

Treat `npm audit` as a release signal, not a success guarantee: document and
resolve or explicitly accept any remaining transitive advisory before
production promotion. Compilation and simulator/unit tests do not prove
Bluetooth behavior, print quality, or recovery on the physical M2_H.
