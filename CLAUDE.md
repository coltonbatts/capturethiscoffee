# Capture This Coffee - Claude Handoff

Last updated: 2026-07-24

This is the root handoff for Claude/Claude Code. Treat it as the starting context for the project, then verify details against the files before editing.

## Non-negotiable agent rule

Follow `AGENTS.md`.

This repo uses Next.js `16.2.11`, which has breaking changes versus older Next.js assumptions. Before writing Next.js code, read the relevant guide under `node_modules/next/dist/docs/`. One concrete example already in this app: the request middleware file is `src/proxy.ts`, not `middleware.ts`.

## Product summary

Capture This Coffee is a mobile-first coffee-runner app for production shoots. One sentence: put today's people in the roster, collect their drinks, print their labels.

Primary users:

- Team member (any signed-in user): prepares people, photos, shoot days, and rosters.
- Runner: goes around set collecting each person's drink order on a phone.
- PA / label operator: prints the captured drinks as a batch via the **CTC Printer** iOS app (`mobile/`) or exports from `/labels`.

The app has two primary sections — **Day** (`/productions`: the shoot day, everyone on set and what they ordered) and **Labels** (`/labels`) — plus **People** (`/people`) as the crew database. The Clients admin UI was removed 2026-07-03; the `clients` table remains and a day's optional client/brand name is used only for label branding.

Core workflow:

1. A team member signs in and creates people/day/roster.
2. Runner opens the share link (`/run/[id]?token=...`), taps a person, takes their drink order (or marks "No drink").
3. The board tracks one progress metric: drinks captured out of roster total.
4. Once drinks are captured, labels print as a batch: **CTC Printer** (`mobile/`) for direct M2_H BLE printing, or `/labels` for batch PNG/CSV export.

Simplified collection model (since 2026-07-05): the UI exposes only "needs order", "captured", "no drink", and a printed flag. The database still stores the wider legacy `OrderStatus` enum (`confirmed`/`ordered`/`picked_up`/`delivered` all render as captured; `src/lib/order-progress.ts` is the mapping). Do not reintroduce delivery-pipeline status UI (confirmed → ordered → picked up → delivered) — it was removed deliberately.

## Latest physical milestone

On July 24, 2026, the account owner installed iOS build 6, loaded the
holographic label stock for the first time, selected a reprint, and produced a
legible physical label on the first attempt. Capture This controlled the
NIIMBOT M2_H directly over Bluetooth LE; there was no laptop, USB connection,
local print station, official NIIMBOT app, or other printing bridge. The
photo-backed record is in
[`docs/milestones/2026-07-24-build-6-holographic-first-print.md`](docs/milestones/2026-07-24-build-6-holographic-first-print.md).
This proves the single-label phone-to-printer path on the intended stock, but
the batch, interruption-recovery, web-sync, cold-cup, and independent-operator
parts of the physical release gate remain open.

## Current strategic direction

The printer strategy is settled for now:

- Keep the NIIMBOT M2_H.
- Do not rebuild a laptop print station.
- Do not attempt custom Bluetooth printing from the web app (Safari on iOS has no Web Bluetooth).
- **Primary on-set path (July 2026):** native iOS app in `mobile/` (Flutter + `niim_blue_flutter`) prints to the M2_H over BLE. The app consumes the label queue + server PNG API and syncs `label_printed`. See `mobile/README.md` and `docs/phone-printing-investigation.md`. Do not update printer firmware while this is in play.
- **Fallback:** `/labels` PNG share/download or NIIMBOT batch CSV through the official NIIMBOT app.

The `/labels` screen currently supports two paths:

- CSV export for NIIMBOT batch templates, intended for bulk crew labels.
- PNG export/share/download for hero/client cups and high-control branded labels.

PNG preset is `50mm x 30mm @ 300 DPI` from `src/lib/niimbot-m2-preset.json`. Physical printing through the CTC Printer BLE path is proven on the real M2_H, including one first-try build-6 reprint on holographic stock on 2026-07-24. The NIIMBOT-app PNG-import fallback path remains unverified.

## Tech stack

- Next.js `16.2.11`, App Router, React `19.2.7`.
- TypeScript strict mode.
- Supabase Auth, Postgres, RLS, and private `person-photos` Storage bucket.
- Tailwind CSS v4 via `@tailwindcss/postcss`.
- `lucide-react` for icons.
- Node test runner with `tsx`.
- `sharp` is available for image-related work.

Useful commands:

```bash
npm install
npm run dev
npm run lint
npm run test
npm run build
npm run verify:niimbot-export
```

Local app URL: `http://localhost:3000`.

## Runtime data backend

Supabase is the application's only runtime data backend. Local development
requires a configured Supabase project; missing or malformed configuration
shows an actionable error and never activates seed or browser-database data.
`localStorage` is used only for harmless UI preferences.

Required public env vars are listed in `.env.example`:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

Server API routes also require `SUPABASE_SERVICE_ROLE_KEY`. That key is used only in server route code through `src/lib/supabase-server.ts`; never expose it to browser code.

## High-level file map

```text
src/proxy.ts
  Next 16 proxy. Gates /productions, /people, /labels behind Supabase sign-in;
  redirects legacy /productions/[id]?token runner links to /run/[id].

src/app/
  layout.tsx, page.tsx, manifest.ts, globals.css
  login/page.tsx, privacy/page.tsx, support/page.tsx
  productions/{page,productions-client,layout}.tsx
  productions/new/{page,new-production-client}.tsx
  productions/[id]/{page,layout,components,production-dashboard-client}.tsx
  productions/[id]/{use-coffee-store,use-roster-view}.ts
  run/[id]/{page,runner-board}.tsx + use-runner-board.ts  (public token runner board)
  people/{page,people-client,layout}.tsx
  labels/{page,labels-client,layout}.tsx
  operator-actions.ts
  api/public/productions/[id]/route.ts
  api/public/productions/[id]/labels/route.ts
  api/public/orders/[id]/route.ts
  api/public/orders/[id]/label/route.ts

src/components/
  app-shell.tsx, app-auth-provider.tsx, providers.tsx, home-auth-button.tsx
  public-info-page.tsx, capture-mark.tsx
  coffee-label-renderer.tsx, person-photo-field.tsx, ui.tsx

src/lib/
  types.ts, auth.ts, people.ts, person-photo-upload.ts, data-errors.ts
  supabase.ts, supabase-server.ts, supabase-config.ts
  operator-inputs.ts, operator-validation.ts
  operator-production-{reconciliation,load-state,people}.ts
  production-share.ts, share-links.ts, share-url.ts, public-api-guard.ts, route-access.ts
  production-board.ts, production-order-preference.ts, order-progress.ts, order-summary.ts
  printer-queue.ts, label-copy.ts, label-export.ts, label-preparation.ts
  label-designs.ts, brand-assets.ts
  niimbot-m2-export.ts, niimbot-m2-export-server.ts, niimbot-m2-draw.ts, niimbot-m2-preset.json

src/server/
  auth.ts
  operator/{context,clients,people,productions,roster,orders,order-drafts,queries,mappers,errors,validation}.ts
  productions/{dto,queries}.ts  (token-scoped runner/printer DTOs)

mobile/
  CTC Printer Flutter app (see mobile/README.md)

supabase/
  schema.sql
  migrations/*.sql

tests/
  *.test.ts (19 files — see "Current tests")
```

## Data model

Domain types live in `src/lib/types.ts`.

Main tables/types:

- `clients`
- `people`
- `client_people`
- `productions`
- `production_share_tokens`
- `production_roster`
- `orders`

Important fields:

- `Person` includes name, type, role, department, company, photo URL, usual order, dietary notes, notes, and active flag.
- `Production` has status `planning`, `active`, or `complete`.
- `Order` has drink fields plus status and `label_printed`. The stored `OrderStatus` enum is wider than the UI: the app distinguishes only needs-order (`not_asked`), captured (any other non-skip status), and skipped (`no_order`) via `src/lib/order-progress.ts`.

Authenticated operator table access lives in the server-only domain DAL under
`src/server/operator/`, and mutations enter through
`src/app/operator-actions.ts`. Each DAL operation creates a request-scoped
anon-key client from the signed-in cookie session and verifies the user. The
browser Supabase client remains only for auth/session observation, Realtime as
a refresh notification, and the documented person-photo Storage exception.
Token-scoped runner/printer operations stay in public API routes and
DTO-focused clients.

## Auth and access model

Team access (since 2026-07-03):

- Any signed-in Supabase Auth user has full access. Admin/staff app metadata is no longer required or consulted.
- `src/lib/auth.ts` keeps the `isAdminAppUser` name for compatibility, but it now just means "signed in" (same for the `isAdmin` flag from `useAppAuth`).
- `src/proxy.ts` protects `/people`, `/labels`, and all of `/productions` behind sign-in (`isProtectedOperatorPath` in `src/lib/route-access.ts`).

Runner access:

- Runners do not need an account for the active day-of board.
- They need a production share link with a token; the runner board is `/run/[id]?token=...` (legacy `/productions/[id]?token=...` links redirect there).
- Share links are minted and copied from the production board UI (`mintProductionShareTokenAction` in `src/app/operator-actions.ts`).
- Tokens are stored as SHA-256 hashes in `production_share_tokens`.
- The public API routes use the service-role client, validate the token, and return/update only scoped production data.
- Runner payloads intentionally omit private person notes and dietary notes, but include `usual_order` as an operational prompt.

Public routes:

- `GET /api/public/productions/[id]?token=...` returns scoped runner data for `planning` or `active` productions.
- `GET /api/public/productions/[id]/labels?token=...` returns the printer label queue for the CTC Printer app.
- `GET /api/public/orders/[id]/label?token=...` renders a single label PNG server-side (`src/lib/niimbot-m2-export-server.ts`).
- `PATCH /api/public/orders/[id]` accepts `{ productionId, token, patch }`, validates the token, requires the production to be `active`, and only allows fields listed in `runnerOrderFields` in `src/lib/production-share.ts`.
- All public routes are rate-limited via `src/lib/public-api-guard.ts`.

Supabase RLS:

- Base schema and policies are in `supabase/schema.sql`.
- Apply migrations in `supabase/migrations` in filename order.
- Current intended posture: anonymous direct table reads/writes are revoked; any authenticated user manages all data (`20260703120000_authenticated_full_access.sql`); runner access goes through token-scoped API routes. `public.current_user_is_admin()` stays defined in case access needs re-tightening later.

## UI and design conventions

The app is intentionally simple, mobile-first, and utilitarian for on-set use.

Use existing primitives before adding new styling:

- `src/components/ui.tsx`
- `Panel`
- `Avatar`
- `EmptyState`
- `Field`
- `inputClass`
- `primaryButtonClass`
- `secondaryButtonClass`
- `dangerButtonClass`

Design constraints:

- Keep screens fast to scan on a phone.
- Prefer compact controls over marketing-style sections.
- Use lucide icons where icons are needed.
- Do not add explanatory in-app text unless it prevents an operational mistake.
- Keep label rendering sharp and brand-forward; labels are part of the product, not just operations.

## Important implementation notes

- Do not expose service-role credentials in client code. Browser code must use only public Supabase URL/anon key.
- Before editing Next.js routing, request, response, config, or proxy behavior, check `node_modules/next/dist/docs/`.
- `context.params` in current route handlers is awaited as a Promise; preserve current Next 16 conventions unless docs say otherwise.
- `src/app/productions/[id]/use-coffee-store.ts` owns operator-board loading, optimistic order updates, retry, and rollback; the public runner board has its own store in `src/app/run/[id]/use-runner-board.ts`. Both are good patterns to preserve.
- `src/lib/production-share.ts` is the security boundary for public runner data and order patches. Add tests for changes there.
- `src/app/labels/labels-client.tsx` is still a large file, but it is the correct label-asset workflow, not an obsolete print station (`labels/page.tsx` is now a thin wrapper).
- Avoid reviving removed laptop/USB print-station concepts. Existing docs that mention them may be historical.

## Current tests

Existing tests (19 files in `tests/`):

- `auth.test.ts`
- `label-copy.test.ts`
- `label-export.test.ts`
- `niimbot-m2-export-server.test.ts`
- `operator-boundary.test.ts`
- `operator-production-load-state.test.ts`
- `operator-production-people.test.ts`
- `operator-production-reconciliation.test.ts`
- `order-progress.test.ts`
- `order-summary.test.ts`
- `printer-queue.test.ts`
- `production-board-state.test.ts`
- `production-dto.test.ts`
- `production-order-preference.test.ts`
- `production-share.test.ts`
- `public-api-guard.test.ts`
- `route-separation.test.ts`
- `share-links.test.ts`
- `supabase-runtime.test.ts`

Run:

```bash
npm run test
npm run lint
npm run build
```

For label output checks:

```bash
npm run verify:niimbot-export
```

## Known risks and backlog

### Mostly resolved - Verify physical label workflow

Physical printing via the primary path (CTC Printer app → M2_H over BLE, 50mm x 30mm @ 300 DPI) is proven on real stock as of 2026-07-23. Still open: verify the fallback path (PNG export from `/labels` imported into the official NIIMBOT app) and record findings in `docs/label-image-export.md`.

### Completed - Validate production deployment access

Live deployment, env vars, RLS posture, anonymous-access denial, and share-token behavior were verified for the 1.0.0 release; evidence in `docs/release-evidence-1.0.0.md`. Public Supabase signup is disabled (verified 2026-07-23).

### Completed - operator DAL migration (Phase 5)

Authenticated operator pages receive initial data from Server Components,
operator table mutations use authenticated Server Actions, and
`src/lib/data.ts` has been removed. The production board refreshes scoped
server props on Realtime notifications and every 10 seconds, preserving pending
optimistic orders during reconciliation. Public runner/printer APIs are
unchanged.

### P1 - Consider public-runner realtime after production proof

The authenticated operator board already subscribes to Supabase Realtime for
`orders` and retains a 10-second polling fallback. The public token runner
intentionally uses a 10-second public API poll. Do not give the runner direct
Supabase access or replace that polling path during Phase 4; any later realtime
design must preserve the account-free token boundary and optimistic-edit merge.

### P1 - Split large UI files

Large files:

- `src/app/productions/[id]/components.tsx` is about 1130 lines.
- `src/app/labels/labels-client.tsx` is about 920 lines.

Do this only when working in those areas. Avoid refactors that do not support a product change or bug fix.

### P1 - Strengthen test coverage

Since covered: Supabase runtime config (`supabase-runtime.test.ts`), token validation and rate limiting (`production-share.test.ts`, `public-api-guard.test.ts`), CSV export content (`label-export.test.ts`), label PNG dimensions (`niimbot-m2-export-server.test.ts`).

Remaining high-value next test:

- Roster view filtering/grouping (`src/app/productions/[id]/use-roster-view.ts`).

### P2 - Product polish

- Improve label design variants (`src/lib/label-designs.ts` has 8 designs including Halo/Orbit holographic; label designs are the current product frontier).
- Add final NIIMBOT CSV template guidance after physical testing of the fallback path.
- Keep docs current as implementation changes. (Share-link admin flow is done: links are minted from the production board UI.)

## Verify before trusting

Load-bearing claims in this doc, and a sub-minute re-check for each:

- Next/React versions: `grep '"next"\|"react"' package.json`.
- npm scripts: `grep -A8 scripts package.json`.
- File map: `find src -type f | sort` and compare.
- Test list: `ls tests/`.
- Line counts for the "split large files" items: `wc -l "src/app/productions/[id]/components.tsx" src/app/labels/labels-client.tsx`.
- Proxy-protected routes and legacy runner redirect: read `src/proxy.ts` (matcher at bottom) and `src/lib/route-access.ts`.
- Public API surface: `ls -R src/app/api/public`.
- Runner patch allowlist: `grep -A10 runnerOrderFields src/lib/production-share.ts`.
- Schema tables: `grep "create table" supabase/schema.sql`.
- Latest applied migration / RLS posture: `ls supabase/migrations/` (hosted-DB state is in memory/docs, not the repo).
- Physical print / release status: `docs/release-evidence-1.0.0.md` and `docs/physical-release-test.md` — but repo docs lag reality; treat dated claims here (2026-07-23) as the floor, not the ceiling.

## Documentation status

Reliable current docs:

- `README.md`
- `docs/standard-operating-procedure.md`
- `docs/v1-readiness.md`
- `docs/label-image-export.md`
- `docs/niimbot-m2-plan.md`

Use with caution:

- `docs/llm-improvement-brief.md` contains useful product history but is stale in places. It references removed print-station files and older security problems that have since been addressed with share tokens and stricter RLS. Do not treat it as authoritative without checking the current repo.

Local/private:

- `docs/luke-handoff.local.md` exists and appears intentionally local. Do not commit secrets or credentials.

## Suggested first Claude prompt

```text
You are taking over the Capture This Coffee repo. Start by reading CLAUDE.md, AGENTS.md, README.md, src/lib/types.ts, src/server/operator/context.ts, src/server/operator/queries.ts, src/app/operator-actions.ts, src/lib/production-share.ts, src/proxy.ts, src/app/productions/[id]/use-coffee-store.ts, src/app/labels/labels-client.tsx, supabase/schema.sql, and the specific files related to my task. This repo uses Next.js 16.2.11, so before editing Next-specific APIs, read the relevant docs in node_modules/next/dist/docs/. Preserve the current NIIMBOT strategy: the CTC Printer iOS app (mobile/) prints to the M2_H over BLE via the public label APIs; /labels PNG/CSV export is the fallback.
```

## Before handing work back

Claude should report:

- Files changed.
- Behavior changed.
- Tests run and results.
- Any unverified assumptions, especially around Supabase, deployment, or physical NIIMBOT printing.
- Any existing unrelated git changes left untouched.
