# Capture This Coffee - Claude Handoff

Last updated: 2026-07-01

This is the root handoff for Claude/Claude Code. Treat it as the starting context for the project, then verify details against the files before editing.

## Non-negotiable agent rule

Follow `AGENTS.md`.

This repo uses Next.js `16.2.6`, which has breaking changes versus older Next.js assumptions. Before writing Next.js code, read the relevant guide under `node_modules/next/dist/docs/`. One concrete example already in this app: the request middleware file is `src/proxy.ts`, not `middleware.ts`.

## Product summary

Capture This Coffee is a mobile-first coffee-runner app for production shoots. It manages clients, people, productions, rosters, live drink orders, coffee-shop summaries, and branded cup-label exports.

Primary users:

- Admin: prepares clients, people, photos, productions, and rosters.
- Runner: works a live production through drink statuses on a phone.
- PA / label operator: exports labels and prints through the NIIMBOT mobile app.

Core workflow:

1. Admin signs in and creates client/people/production/roster.
2. Runner opens a production board and confirms or edits drinks.
3. Runner moves orders through `not_asked`, `confirmed`, `ordered`, `picked_up`, `delivered`, or `no_order`.
4. Runner uses the Summary tab for coffee-shop handoff.
5. Label operator uses `/labels` to export either a NIIMBOT batch CSV or print-ready PNGs.

## Current strategic direction

The printer strategy is settled for now:

- Keep the NIIMBOT M2.
- Do not rebuild a laptop print station.
- Do not attempt custom Bluetooth printing from the web app.
- CTC generates assets; the NIIMBOT first-party app owns printer pairing and physical printing.

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

## Runtime modes

The app has two data modes:

- Supabase-backed mode: `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set, and `NEXT_PUBLIC_ENABLE_AUTH` is unset or `true`.
- Local demo mode: `NEXT_PUBLIC_ENABLE_AUTH=false`; data lives only in browser `localStorage`.

Production must use Supabase-backed mode. Local demo mode is useful for fast local UI work but should not be treated as shared or durable data.

Required public env vars are listed in `.env.example`:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_ENABLE_AUTH=
```

Server API routes also require `SUPABASE_SERVICE_ROLE_KEY`. That key is used only in server route code through `src/lib/supabase-server.ts`; never expose it to browser code.

## High-level file map

```text
src/proxy.ts
  Next 16 proxy. Gates admin setup routes behind Supabase admin auth.

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
  clients/page.tsx
  clients/[id]/page.tsx
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
  production-share.ts
  storage.ts
  seed.ts
  people.ts
  person-photo-upload.ts
  order-summary.ts
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
  label-copy.test.ts
  label-export.test.ts
  order-summary.test.ts
  production-share.test.ts
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
- `Order` has drink fields plus status and `label_printed`.

`src/lib/data.ts` is the main browser data layer. It is large and intentionally supports both Supabase and local demo mode. Be careful when changing it: many functions have a Supabase branch and a localStorage branch.

## Auth and access model

Admin access:

- Admin users are Supabase Auth users with app metadata such as `{"admin": true}`.
- `src/lib/auth.ts` recognizes admin/staff metadata variants.
- `src/proxy.ts` protects `/people`, `/clients`, `/labels`, and `/productions/new`.

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
- Current intended posture: anonymous direct table reads/writes are revoked; admins manage setup data; runner access goes through token-scoped API routes.

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

- `tests/order-summary.test.ts`
- `tests/label-copy.test.ts`
- `tests/label-export.test.ts`
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
- Confirm admin users can manage setup data.
- Confirm share-token runner links work on a second device.

### P1 - Reduce data-layer complexity

`src/lib/data.ts` is about 1,385 lines and duplicates behavior for Supabase and local demo mode. This is the largest maintainability issue.

Preferred direction:

- Keep Supabase as the only production source of truth.
- Either move local demo behavior behind a small adapter or limit it to read-only seed/demo workflows.
- Add focused tests before broad refactors.

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

- `data.ts` behavior around Supabase/local mode branches.
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
