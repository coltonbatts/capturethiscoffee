# Capture This Coffee - Claude Handoff

Last updated: 2026-07-05

This is the root handoff for Claude/Claude Code. Treat it as the starting context for the project, then verify details against the files before editing.

## Non-negotiable agent rule

Follow `AGENTS.md`.

This repo uses Next.js `16.2.6`, which has breaking changes versus older Next.js assumptions. Before writing Next.js code, read the relevant guide under `node_modules/next/dist/docs/`. One concrete example already in this app: the request middleware file is `src/proxy.ts`, not `middleware.ts`.

## Product summary

Capture This Coffee is a mobile-first coffee-runner app for production shoots. One sentence: put today's people in the roster, collect their drinks, print their labels.

Primary users:

- Team member (any signed-in user): prepares people, photos, shoot days, and rosters.
- Runner: goes around set collecting each person's drink order on a phone.
- PA / label operator: prints the captured drinks as a batch via the **CTC Printer** iOS app (`mobile/`) or exports from `/labels`.

The app has two primary sections — **Day** (`/productions`: the shoot day, everyone on set and what they ordered) and **Labels** (`/labels`) — plus **People** (`/people`) as the crew database. The Clients admin UI was removed 2026-07-03; the `clients` table remains and a day's optional client/brand name is used only for label branding.

Core workflow:

1. A team member signs in and creates people/day/roster.
2. Runner opens the production roster, taps a person, takes their drink order (or marks "No drink").
3. The board tracks one progress metric: drinks captured out of roster total.
4. Once drinks are captured, labels print as a batch: **CTC Printer** (`mobile/`) for direct M2_H BLE printing, or `/labels` for batch PNG/CSV export.

Simplified collection model (since 2026-07-05): the UI exposes only "needs order", "captured", "no drink", and a printed flag. The database still stores the wider legacy `OrderStatus` enum (`confirmed`/`ordered`/`picked_up`/`delivered` all render as captured; `src/lib/order-progress.ts` is the mapping). Do not reintroduce delivery-pipeline status UI (confirmed → ordered → picked up → delivered) — it was removed deliberately.

## Current strategic direction

The printer strategy is settled for now:

- Keep the NIIMBOT M2_H.
- Do not rebuild a laptop print station.
- Do not attempt custom Bluetooth printing from the web app (Safari on iOS has no Web Bluetooth).
- **Primary on-set path (July 2026):** native iOS app in `mobile/` (Flutter + `niim_blue_flutter`) prints to the M2_H over BLE. Spike passed; Phase 2 ships label queue + server PNG API + `label_printed` sync. See `mobile/README.md` and `docs/phone-printing-investigation.md`. Do not update printer firmware while this is in play.
- **Fallback:** `/labels` PNG share/download or NIIMBOT batch CSV through the official NIIMBOT app.

The `/labels` screen currently supports two paths:

- CSV export for NIIMBOT batch templates, intended for bulk crew labels.
- PNG export/share/download for hero/client cups and high-control branded labels.

Current assumed PNG preset is `50mm x 30mm @ 300 DPI` from `src/lib/niimbot-m2-preset.json`. This still needs physical verification against the actual label roll and NIIMBOT app import behavior.

## Tech stack

- Next.js `16.2.6`, App Router, React `19.2.4`.
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
  Next 16 proxy. Gates setup routes behind Supabase sign-in (any user).

src/app/
  layout.tsx
  page.tsx
  login/page.tsx
  productions/page.tsx
  productions/new/page.tsx
  productions/[id]/page.tsx
  productions/[id]/components.tsx
  productions/[id]/use-coffee-store.ts
  productions/[id]/use-roster-view.ts
  people/page.tsx
  labels/page.tsx
  api/public/productions/[id]/route.ts
  api/public/orders/[id]/route.ts

src/components/
  app-shell.tsx
  app-auth-provider.tsx
  coffee-label-renderer.tsx
  person-photo-field.tsx
  ui.tsx

src/lib/
  data.ts
  types.ts
  auth.ts
  supabase.ts
  supabase-server.ts
  supabase-config.ts
  production-share.ts
  people.ts
  person-photo-upload.ts
  order-progress.ts
  order-summary.ts
  printer-queue.ts
  label-copy.ts
  label-export.ts
  label-designs.ts
  niimbot-m2-export.ts
  niimbot-m2-preset.json
  brand-assets.ts

supabase/
  schema.sql
  migrations/*.sql

tests/
  auth.test.ts
  label-copy.test.ts
  label-export.test.ts
  order-progress.test.ts
  order-summary.test.ts
  printer-queue.test.ts
  production-share.test.ts
  share-links.test.ts
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

`src/lib/data.ts` is the session-bound browser data layer for authenticated
operator operations. It has one persistence path: Supabase. Token-scoped
runner/printer operations stay in public API routes and DTO-focused clients.

## Auth and access model

Team access (since 2026-07-03):

- Any signed-in Supabase Auth user has full access. Admin/staff app metadata is no longer required or consulted.
- `src/lib/auth.ts` keeps the `isAdminAppUser` name for compatibility, but it now just means "signed in" (same for the `isAdmin` flag from `useAppAuth`).
- `src/proxy.ts` protects `/people`, `/labels`, and `/productions/new` behind sign-in.

Runner access:

- Runners do not need an account for the active day-of board.
- They need a production share link with a token.
- Tokens are stored as SHA-256 hashes in `production_share_tokens`.
- The public API routes use the service-role client, validate the token, and return/update only scoped production data.
- Runner payloads intentionally omit private person notes and dietary notes, but include `usual_order` as an operational prompt.

Public routes:

- `GET /api/public/productions/[id]?token=...` returns scoped runner data for `planning` or `active` productions.
- `PATCH /api/public/orders/[id]` accepts `{ productionId, token, patch }`, validates the token, requires the production to be `active`, and only allows fields listed in `runnerOrderFields` in `src/lib/production-share.ts`.

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
- `src/app/productions/[id]/use-coffee-store.ts` owns runner-board loading, optimistic order updates, retry, and rollback. It is a good pattern to preserve.
- `src/lib/production-share.ts` is the security boundary for public runner data and order patches. Add tests for changes there.
- `src/app/labels/page.tsx` is still a large page, but it is now the correct label-asset workflow, not an obsolete print station.
- Avoid reviving removed laptop/USB print-station concepts. Existing docs that mention them may be historical.

## Current tests

Existing tests cover:

- `tests/order-progress.test.ts`
- `tests/order-summary.test.ts`
- `tests/label-copy.test.ts`
- `tests/label-export.test.ts`
- `tests/printer-queue.test.ts`
- `tests/production-share.test.ts`

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

### P0 - Verify physical label workflow

The app assumes 50mm x 30mm at 300 DPI. Confirm against the actual NIIMBOT M2 roll and mobile app import behavior.

Tasks:

- Read the physical roll dimensions and shape.
- Export one PNG from `/labels`.
- Import it into the NIIMBOT app.
- Print on the actual stock.
- Update `src/lib/niimbot-m2-preset.json` if sizing is wrong.
- Record findings in `docs/label-image-export.md` and `docs/niimbot-m2-plan.md`.

### P0 - Validate production deployment access

Before real client use:

- Confirm deployed env vars.
- Confirm `SUPABASE_SERVICE_ROLE_KEY` is set for public API routes.
- Confirm RLS is active.
- Confirm anonymous direct table reads/writes fail.
- Confirm signed-in users can manage setup data (apply `20260703120000_authenticated_full_access.sql`).
- Confirm share-token runner links work on a second device.

### P1 - Continue the operator DAL migration

Supabase is now the only runtime source of truth, but authenticated operator
reads and writes still use the session-bound browser client. A later phase can
move those operations into server-only DAL functions and Server Actions while
preserving the current DTO and token API contracts.

### P1 - Add realtime sync

The runner board currently loads data and performs optimistic updates, but it does not subscribe to cross-device changes. Supabase Realtime would improve live shoot reliability when multiple devices are open.

Likely scope:

- Subscribe to `orders` for the open production.
- Consider `production_roster` if roster edits happen during the shoot.
- Merge server changes without clobbering in-flight optimistic local edits.

### P1 - Split large UI files

Large files:

- `src/app/productions/[id]/components.tsx` is about 937 lines.
- `src/app/labels/page.tsx` is about 654 lines.

Do this only when working in those areas. Avoid refactors that do not support a product change or bug fix.

### P1 - Strengthen test coverage

High-value next tests:

- Session-bound Supabase data behavior and sanitized configuration failures.
- API route token validation and order patch behavior.
- Roster view filtering/grouping.
- CSV export content if NIIMBOT batch becomes a core workflow.
- Label PNG generation dimensions.

### P2 - Product polish

- Improve label design variants in `src/components/coffee-label-renderer.tsx`.
- Add final NIIMBOT CSV template guidance after physical testing.
- Improve admin flow for generating and copying production share links; currently token creation is documented with SQL in `README.md`.
- Keep docs current as implementation changes.

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
You are taking over the Capture This Coffee repo. Start by reading CLAUDE.md, AGENTS.md, README.md, src/lib/types.ts, src/lib/data.ts, src/lib/production-share.ts, src/proxy.ts, src/app/productions/[id]/use-coffee-store.ts, src/app/labels/page.tsx, supabase/schema.sql, and the specific files related to my task. This repo uses Next.js 16.2.6, so before editing Next-specific APIs, read the relevant docs in node_modules/next/dist/docs/. Preserve the current NIIMBOT strategy: CTC exports CSV/PNG assets and the NIIMBOT app prints them.
```

## Before handing work back

Claude should report:

- Files changed.
- Behavior changed.
- Tests run and results.
- Any unverified assumptions, especially around Supabase, deployment, or physical NIIMBOT printing.
- Any existing unrelated git changes left untouched.
