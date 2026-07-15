# Capture This Coffee app experience map

Last updated: 2026-07-03

## Product truth

Capture This Coffee exists to make a shoot-day coffee run reliable: every
person gets the right drink, the runner can move quickly, and label printing
does not become the bottleneck.

The product should optimize one simple loop:

1. **Prepare** - sign in, create/select the shoot day, add or select people,
   confirm the roster, and generate the shared runner/printer link.
2. **Run** - runner opens the token link, searches a person, confirms or edits
   the drink, and advances status.
3. **Print** - CTC Printer opens the same token link, fetches pending labels,
   prints over BLE, and marks `label_printed`.
4. **Handoff** - summary groups the coffee-shop order, then the runner tracks
   ordered, picked up, and delivered.
5. **Close out** - mark the production complete, preserve useful usual orders,
   and record cleanup items outside the live runner loop.

## Primary path vs fallback paths

Primary on-set path:

- Web app for setup and the runner board.
- Runner share-token URL for anonymous day-of access to one production.
- Native iOS **CTC Printer** app in `mobile/` for printing labels. It consumes
  the same share URL, calls the public label API, prints to the NIIMBOT M2_H,
  and marks `label_printed`.

Fallback and advanced paths:

- `/labels` is an authenticated fallback/export screen for PNG download/share,
  CSV batch export, preview, and test labels when CTC Printer is unavailable or
  an advanced export is needed.
- Official NIIMBOT app import is historical/fallback only. It is not the main
  on-set printing path now that CTC Printer exists.
- Local `localStorage` mode is dev/demo only. It is useful for offline local
  exploration, but it is not production data and cannot mint runner links.

Historical/cancelled paths:

- Laptop print station, USB serial worker, Web Bluetooth from Safari, Brother
  printers, and AirPrint are not current product paths.

## User roles

| Role | Access | Primary jobs |
|---|---|---|
| Signed-in operator | Full app access through Supabase Auth | Create productions, manage people, maintain rosters, generate runner/printer links, use fallback exports |
| Runner | Production share-token URL, no account required | Search people, confirm/edit drinks, advance statuses, use summary for handoff |
| Label operator | CTC Printer plus production share-token URL | Fetch pending labels, print each label, mark `label_printed` |

Per `src/lib/auth.ts`, every signed-in Supabase user has full app access.
Older `app_metadata.admin` or staff-role references are stale unless a future
access-control change reintroduces roles.

## Route ownership

| Route | Owner | Canonical purpose |
|---|---|---|
| `/` | Launch/navigation | Send users toward the active-day workflow and setup, with fallback export de-emphasized |
| `/login` | Signed-in operator | Supabase Auth entry point |
| `/productions` | Signed-in operator | Shoot-day list, active-day entry point, new-day creation |
| `/productions/new` | Signed-in operator | Prepare a shoot day |
| `/productions/[id]` | Signed-in operator | Live board plus production and roster setup, label links, and runner/printer link sharing |
| `/run/[id]?token=…` | Token-scoped runner | Live drink/order workflow only |
| `/people` | Signed-in operator | Supporting people database and usual orders |
| `/labels` | Signed-in operator | Fallback/advanced PNG and CSV export, preview, test labels |
| `/api/public/productions/[id]` | Runner/printer token API | Token-scoped runner payload |
| `/api/public/productions/[id]/labels` | CTC Printer token API | Token-scoped label queue |
| `/api/public/orders/[id]/label` | CTC Printer token API | Server-rendered label PNG |
| `/api/public/orders/[id]` | Runner/printer token API | Token-scoped operational order updates, including `label_printed` |

## Data model

Core entities:

- `productions` - the shoot day and lifecycle (`planning`, `active`,
  `complete`).
- `people` - reusable people records, photos, and usual orders.
- `production_roster` - who is on a specific shoot day and their group.
- `orders` - day-specific drink, status, and `label_printed` state.
- `production_share_tokens` - scoped access for runner and CTC Printer.

Supporting entities:

- `clients` and `client_people` - setup convenience for recurring people.
- Supabase Storage `person-photos` - optional identification support.
- Local demo seed/storage - development-only mirror path.
- Label renderer/export helpers - shared print asset generation.

## Candidate cuts and reductions

Do not delete these in the first pass. Treat them as candidates to validate and
sequence after the product story is aligned.

- Hide or further de-emphasize `/labels` in primary navigation once CTC Printer
  has passed an end-to-end deployed shoot test.
- Split the production dashboard into clearer runner and setup sections so
  roster editing, production editing, quick add, runner-link creation, and
  order editing do not compete with the live runner loop.
- Consolidate or isolate the localStorage demo path so production behavior has
  one obvious source of truth.
- Add a first-class share-link management UI instead of relying on a single
  copy-runner-link action plus SQL examples.
- Surface printed/not-printed state consistently in the runner board and close
  out summary.
- Mark older NIIMBOT app import, Brother/AirPrint, and laptop print station docs
  as historical where they remain useful context.

## Current contradictions to watch

- `docs/phone-printing-investigation.md` is a strategy/history doc written just
  before CTC Printer shipped. It is useful background, but its "do both in this
  order" recommendation is superseded by the native app now being primary.
- Full production validation still needs a deployed end-to-end pass: runner link
  to CTC Printer, real label print, and `label_printed` visible back in the web
  app.
- The fallback PNG/CSV export remains useful, but it should not drive the main
  information architecture.
