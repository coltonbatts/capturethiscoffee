# Capture This Coffee — Engineering Brief for an LLM Collaborator

> **STATUS (2026-07-01): HISTORICAL — do not work from this document.**
> This brief predates major changes and much of it no longer matches the repo.
> Start from [README.md](../README.md),
> [docs/app-experience-map.md](app-experience-map.md), and
> [docs/production-readiness-checklist.md](production-readiness-checklist.md)
> instead.
> What has already been resolved since this was written:
>
> - **P0-A and P0-B (open anon reads/writes) are fixed.** Runner access now goes
>   through SHA-256-hashed share tokens (`src/lib/production-share.ts`) and
>   token-scoped API routes (`src/app/api/public/...`). Anonymous direct table
>   reads/writes are revoked in the current migrations. Runner payloads omit
>   dietary notes and private notes.
> - **Phase 1 (remove the laptop print pipeline) is done.** The print-station
>   page, USB-serial scripts, label queue, print-job API routes, direct-Bluetooth
>   probe, and the `printer_devices`/`label_print_jobs`/`label_print_attempts`
>   tables are all deleted. `src/app/labels/page.tsx` is now the CSV + PNG
>   export workstation. Do not recreate any of the print-station files named below.
> - **Phase 1b (label design) is underway.** `coffee-label-renderer.tsx` and
>   `src/lib/niimbot-m2-export.ts` render multiple branded label designs at the
>   50x30mm preset (still pending physical verification — see the checklist).
> - **Phase 2 (native CTC Printer) has shipped after this brief.** The iOS app
>   in `mobile/` is now the primary on-set print path and `/labels` is fallback
>   export. The older NIIMBOT-app-import-first language below is preserved only
>   as product history.
> - **Tests now cover** label copy, label export selection, order summaries, and
>   share-token sanitization/privacy (`tests/`).
>
> Still open, in current priority order: physical NIIMBOT verification and
> deployment validation (the checklist's Sections A and B), then the `data.ts`
> dual-mode consolidation (Phase 2), realtime sync (Phase 3), and splitting the
> large UI files (Phase 5). The product history and reasoning below remain
> useful context; the file map, line counts, and problem list do not reflect
> the current tree.

> **How to use this file:** Paste this whole document into a capable coding LLM as the
> first message of a session. It is a self-contained map of the app: what it is, how it's
> built, what's wrong, and the order to fix things in. Each problem cites the real file so
> the model can go straight to it. When you start a work session, tell the model which
> "Phase" below you want to tackle.

---

## 1. What the app is

Capture This Coffee (CTC) is a **mobile-first coffee-runner app for film/photo production
shoots**. One person (the runner) takes 15–25 crew drink orders and works each one through
a status pipeline during the shoot day: `not_asked → confirmed → ordered → picked_up →
delivered` (plus `no_order`). It also prints a physical label per cup.

Primary user: **Luke** (admin/runner), plus on-set **PAs** (production assistants) who need
the simplest possible printing step. The whole thing is built to be operated one-handed on a
phone, on set, on flaky venue Wi-Fi.

Core flow: `Sign in → open production → confirm drinks → mark ordered → print label →
mark delivered → summary`.

### The label is the brand moment (decided with Luke, latest meeting)
The physical label is **not** just an ops sticker — it is the point. Two explicit goals:
1. **Make the client feel special** — a custom, personalized coffee handed to them.
2. **A branding moment for Capture This** — the label is a tiny piece of brand collateral.

Concrete decisions from the latest meeting:
- **Printer stays the NIIMBOT.** Luke tried Brother printers and dislikes the paper labels.
  The earlier "switch to Brother QL-820NWB / AirPrint" plan is **cancelled.**
- **Labels go on the cup lid** (not the side), as a finishing/branding touch.
- Because the label is a branding object, **design quality matters** — typography, layout,
  and the personalization are the product, not an afterthought. (This plays directly to
  CTC's design strengths.)

---

## 2. Tech stack

- **Next.js 16.2.6** (App Router, React 19) — note: this is a newer Next than most training
  data. The middleware file is `src/proxy.ts` (Next 16 renamed `middleware` → `proxy`).
  `AGENTS.md` warns about this; respect it and check `node_modules/next/dist/docs/` before
  assuming old conventions.
- **Supabase** — Postgres + Auth + Row Level Security + Storage (person photos).
- **Tailwind v4**, lucide-react icons.
- **TypeScript strict mode is on** (good).
- **NIIMBOT M2_H label printer** via local USB-serial Node scripts + a local "print station"
  server. (See §4 — this whole subsystem is on the chopping block.)

### Two runtime modes (important)
The data layer (`src/lib/data.ts`) runs in one of two modes decided by env vars:
1. **Supabase mode** (`NEXT_PUBLIC_ENABLE_AUTH=true` + URL/anon key set) — real shared DB.
2. **Local demo mode** (`NEXT_PUBLIC_ENABLE_AUTH=false`) — seeded data in `localStorage`,
   single-browser only.

Every mutation is implemented **twice** (a Supabase branch and a localStorage branch). This
is the single biggest source of bloat and bugs — see Problem P1-A.

---

## 3. Architecture map (where things live)

```
src/
  proxy.ts                         Next middleware: gates /people /clients /labels
                                   /productions/new behind admin auth
  lib/
    types.ts                       Domain types (Client, Person, Production, Roster, Order)
    data.ts            (1340 ln)   ALL CRUD. Dual-mode (Supabase + localStorage). Bloated.
    auth.ts                        Admin/role checks on the Supabase user
    supabase.ts        (522 ln)    Browser client + generated DB types + config flags
    supabase-server.ts             Service-role + bearer-token route clients
    storage.ts                     localStorage demo persistence + seed cloning
    seed.ts                        Demo seed data
    order-summary.ts               formatDrink() — turns an order into label/summary text
    label-*.ts, niimbot-*.ts,      Label rendering + NIIMBOT printer subsystem
    print-jobs.ts                  (see §4)
  app/
    productions/[id]/
      page.tsx                     Runner dashboard (the main screen)
      components.tsx   (933 ln)    All dashboard UI (cards, editors, sheets) in one file
      use-coffee-store.ts          Data/load/optimistic-update hook (this part is good)
      use-roster-view.ts           Filtering/derived view of roster+orders
    labels/page.tsx    (1299 ln)   Label picker / browser-print UI  ── print subsystem
    labels/station/page.tsx (1102) Local USB print-station UI       ── print subsystem
    people/, clients/, login/      Admin/setup screens
    api/                           Print-job + label-queue route handlers
supabase/
  schema.sql                       Tables, RLS policies, grants
  migrations/                      Incremental RLS/printer/photo changes
scripts/                           NIIMBOT USB diagnostics + print-station launcher
docs/                             Many handoff/runbook docs (mostly about the printer)
tests/                            Only 2 test files (print-jobs, label-copy)
```

---

## 4. The single most important strategic fact

> **Status: this plan REPLACES the older "rip out NIIMBOT / switch to Brother AirPrint" idea.
> The NIIMBOT stays. What gets removed is the laptop-based print pipeline, not the printer.**

**The new model: CTC becomes a label-asset generator; the NIIMBOT's own app does the
printing.**

The sticking point that drove this: the NIIMBOT **cannot be driven over Bluetooth from a
phone** by a third-party app — direct printing requires a **laptop tethered with a USB-C
cord** (that's what the whole `labels/station` + USB-serial subsystem does). Luke wants the
on-set printing step to be dead simple for a PA, and **a laptop on set is too much.**

The idea we landed on:
- **CTC generates a perfect, print-ready label image** (correctly sized for the NIIMBOT lid
  label, on-brand, personalized per crew member).
- The PA **saves that image to their phone's camera roll** straight from CTC.
- The PA opens the **NIIMBOT first-party app** (which Luke already likes), **uploads the
  image, and prints** over the NIIMBOT app's own Bluetooth connection.
- **No laptop, no USB cord, no CTC print-station server, no custom Bluetooth code.**

This keeps the printer Luke loves, removes the laptop, and turns printing into "save image →
open NIIMBOT app → print." CTC's job shrinks to the thing it's good at: **making a beautiful,
correct label asset.**

### What this means for the codebase

**Becomes the core feature (keep + invest in design quality):**
- `src/components/coffee-label-renderer.tsx` — the label visual. This is now a flagship
  surface; it should produce a polished, branded, lid-sized design.
- `src/lib/niimbot-m2-export.ts` — PNG/image export. Repurpose this to export a phone-camera-
  roll-friendly image at the exact NIIMBOT lid-label dimensions/DPI.
- `src/lib/label-copy.ts`, `src/lib/order-summary.ts` (`formatDrink`) — the text on the label.
- `src/app/labels/page.tsx` — becomes a much smaller "preview + Save to Photos / Share" screen
  (today it's 1299 ln of browser-print + queue UI; most of that goes).

**Becomes dead weight (plan to delete — the laptop/USB/queue pipeline):**
- `src/app/labels/station/page.tsx` (1102 ln) — the tethered-laptop station UI.
- `src/lib/niimbot-web-bluetooth.ts` (direct BLE probe — NIIMBOT's app handles Bluetooth now),
  `src/lib/label-queue.ts`, `src/lib/print-jobs.ts`.
- The `print-jobs`, `label-queue`, and `print-station` API routes under `src/app/api/`.
- All `scripts/niimbot-*.mjs`, `start-print-station.mjs`, `label-serial-worker.mjs`, and the
  `Start Print Station.command` launcher.
- Supabase tables `printer_devices`, `label_print_jobs`, `label_print_attempts` and their
  migrations; ~6 printer/station runbook docs in `docs/`.
- `src/lib/label-calibration.ts` — keep only if it's needed to hit exact export dimensions;
  otherwise it was for driving the physical printer and can go.

**Net effect:** still deletes a big chunk of the codebase and removes the "surface sprawl,"
**but the design/export half is elevated, not thrown away.** The hard part is no longer
plumbing a printer — it's making the asset look great and exporting it at the right size.

### Key unknown to confirm before building (see §8)
The exact **NIIMBOT lid-label media** (round vs rectangular, mm dimensions, DPI) and the
**image format/size the NIIMBOT app imports cleanly**. The export must match these exactly or
the print will be cropped/blurry. Confirm with the physical printer + a test import before
committing to dimensions.

---

## 5. Problems, prioritized

Severity: **P0** = fix before real client use · **P1** = fix soon, blocks "good" · **P2** = polish.

### P0-A — Privacy/security: all crew data is world-readable by URL
`supabase/schema.sql` grants `anon` (no login) `SELECT` on `clients`, `people`,
`productions`, `production_roster`, `orders` for any production with status `planning` or
`active`. The README frames this as intentional ("anyone with the link can read"). But
`people` rows include `name`, `company`, `role`, `dietary_notes`, and `notes` — that is crew
PII exposed to anyone who guesses/sees a URL. Photos are in a private bucket (good), but the
rest is open.

**Why it matters:** clients (studios, agencies) will not be comfortable with named crew lists
and dietary/medical notes being publicly fetchable. UUIDs are unguessable, but "unguessable
URL" is not an access-control model.

**Fix direction:** introduce a per-production share token / scoped access (e.g. a signed link
that authorizes reads for exactly one production), or require a lightweight runner sign-in.
Stop exposing `people.dietary_notes`/`notes` to `anon` at minimum.

### P0-B — Privacy/security: anonymous users can edit orders on *any* active production
`schema.sql` policy `"Public can update operational order fields"` lets **any** anonymous
visitor `UPDATE` order fields (drink, status, notes) on **any** production whose status is
`active` — not scoped to a session, device, or single production. Anyone who learns an order
UUID can rewrite drinks/statuses across all live shoots simultaneously.

**Fix direction:** scope writes to a per-production capability token; or require the runner to
authenticate (even anonymously, per-production). At minimum, rate-limit and scope to one
production via the share token from P0-A.

### P1-A — `data.ts` duplicates every mutation (1340 lines)
Because of the two runtime modes, every create/update function has a full Supabase branch
**and** a parallel localStorage branch (see `createPersonRecord`, `createProductionRecord`,
`createPersonAndAddToRoster`, etc.). This doubles the surface for bugs, makes changes
error-prone, and is exactly the kind of complexity a non-CS author should not be maintaining.

**Fix direction:** pick one source of truth. Recommended: make Supabase the only backend and
delete the localStorage write paths (keep a tiny read-only demo seed if a no-network demo is
truly needed). Or, abstract a single `Repository` interface with two implementations so call
sites aren't branched. Either way, callers should not see the branch.

### P1-B — No real-time sync between devices
Orders are loaded once and updated optimistically (`use-coffee-store.ts` — which is actually
well-written). But if two people (or a phone + a laptop) view the same production, neither
sees the other's changes until a manual reload. Supabase Realtime is available and unused.

**Fix direction:** subscribe to `orders`/`production_roster` changes for the open production
and merge into the store. This is high-value for a live shoot.

### P1-C — Almost no automated tests
Only `tests/print-jobs.test.ts` and `tests/label-copy.test.ts` exist (230 lines total), and
both cover the printer code that's being removed. The core data layer, auth gating, and
roster/order logic have **zero** tests.

**Fix direction:** add tests for `order-summary.formatDrink`, the order status transitions,
roster building, and the RLS policies (via a Supabase test harness). This is the safety net
that lets an LLM refactor `data.ts` confidently.

### P2-A — Surface sprawl (the known product issue)
The two label pages are the worst offenders (2400+ lines), but the dashboard UI also lives in
one 933-line `components.tsx`. Removing the laptop/print-station path (Phase 1) deletes most
of `labels/station` and shrinks `labels/page` to a small preview+export screen. Afterward,
split `components.tsx` into per-component files. Note: unlike the earlier plan, the label
*rendering* code survives and gets invested in (Phase 1b) — only the print *plumbing* goes.

### P2-B — Operational hardening gaps
No error monitoring (Sentry/console capture), no analytics on the funnel, no true offline
mode (acknowledged in `docs/v1-readiness.md`), and `null` vs `""` is normalized everywhere
via `present()` instead of being consistent at the type level.

---

## 6. What's already good (don't break these)

- **`use-coffee-store.ts`** — the optimistic-update + rollback + single-flight logic is
  genuinely solid and well-commented. Keep its shape.
- **Day-of resilience** — network errors become a plain "No connection" message; failed saves
  roll back one order, not the screen. Good instincts (README §"Day-of resilience").
- **TypeScript strict mode on**, clean domain types in `types.ts`.
- **RLS exists at all** with an admin model — the *mechanism* is right, the *policy* (P0-A/B)
  is too open.
- Auth/admin gating via `proxy.ts` + `auth.ts` is coherent.

---

## 7. Recommended roadmap (phases to hand the LLM one at a time)

**Phase 0 — Lock down access (P0-A, P0-B).** Before anything else. Add a per-production share
token; stop `anon` from reading PII fields and from updating arbitrary productions. Add tests
for the new policies.

**Phase 1 — Replace the laptop print pipeline with phone asset-export (the big win).**
Two halves:
- *Delete:* the `labels/station` page, USB-serial scripts + launcher, `label-queue`/
  `print-jobs` API routes + Supabase tables, and the direct-Bluetooth probe. (~2500+ lines.)
- *Build:* a clean "label preview → **Save to Photos / Share**" screen that exports a
  print-ready image at the **exact NIIMBOT lid-label dimensions/DPI**, so a PA can save it and
  print from the **NIIMBOT app** with no laptop. Confirm media size first (§8 Q2).
This removes the sprawl *and* delivers the new on-set workflow.

**Phase 1b — Make the label beautiful (the brand moment).** Treat
`coffee-label-renderer.tsx` as a design surface, not an ops sticker: strong typography, the
Capture This mark, clean personalization (name + drink). This is the "make the client feel
special" goal and is high-leverage given CTC's design strengths. Pairs naturally with the
export work in Phase 1.

**Phase 2 — Collapse the dual-mode data layer (P1-A).** Make Supabase the single backend;
delete localStorage write paths or hide them behind one repository interface. Halve `data.ts`.

**Phase 3 — Real-time sync (P1-B).** Supabase Realtime subscription feeding `use-coffee-store`.

**Phase 4 — Tests + monitoring (P1-C, P2-B).** Cover `formatDrink`, status transitions,
roster logic, RLS. Add error reporting.

**Phase 5 — UI cleanup (P2-A).** Split `components.tsx`; trim the runner view to just the
flow Luke uses.

Do Phase 0 and Phase 1 first — they remove the most risk and the most code.

---

## 8. Open questions to resolve before/while building

1. **Access model:** is a per-production share link acceptable, or should runners log in?
   (Drives Phase 0 design.)
2. **NIIMBOT lid-label spec (blocks Phase 1):** exact media (round vs rectangular), mm
   dimensions, and DPI of the lid label Luke is using — and the image format/resolution the
   NIIMBOT app imports without cropping or blurring. Verify with the physical printer + a test
   import before locking export dimensions.
3. **Export UX on iPhone:** is "Save to Photos" then manually opening the NIIMBOT app
   acceptable, or does Luke want it as smooth as possible (e.g. iOS share sheet straight into
   the NIIMBOT app, if NIIMBOT registers as a share target)? Worth a quick test on-device.
4. **Demo mode:** is the localStorage no-network demo still needed, or can it be dropped to
   simplify `data.ts`? (Drives Phase 2.)
5. **Multi-runner:** will more than one person ever edit the same production at once? If yes,
   Phase 3 (realtime) rises in priority.

---

## 9. Quick facts for the model

- Run: `npm install && npm run dev` → http://localhost:3000 (redirects to `/productions`).
- Verify: `npm run lint && npm run build`. Tests: `npm test`.
- Env: `.env.local` needs `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and
  `NEXT_PUBLIC_ENABLE_AUTH`. Service-role key only used by trusted server routes.
- Middleware is `src/proxy.ts`, NOT `middleware.ts` (Next 16).
- ~10,700 lines of TS/TSX in `src`; the 4 biggest files (`data.ts`, both `labels` pages,
  `components.tsx`) are ~45% of it and are all on the "shrink or delete" list.
```
