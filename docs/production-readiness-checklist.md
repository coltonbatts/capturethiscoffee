# Production Readiness Checklist

> **Historical web-first/Build 6 checklist.** Preserve it as prior evidence,
> but use [`current-state-2026-07-25.md`](current-state-2026-07-25.md),
> [`release-evidence-1.0.0.md`](release-evidence-1.0.0.md), and
> [`physical-release-test.md`](physical-release-test.md) for the active Build 9
> boundary.

Last updated: 2026-07-23 (printer handoff audit)

This checklist exists to close out the two P0 blockers before Capture This
Coffee is used on a real paid shoot:

1. **CTC Printer + NIIMBOT M2 label validation** — confirm the native printer
   app can print real labels and mark `label_printed`, and that fallback
   `/labels` export still works when needed.
2. **Production deployment validation** — confirm the hosted app is wired to
   Supabase correctly and that access control actually holds.

The two sections are independent. Section A can be run by a non-engineer
(PA / label operator) with a phone and the printer. Section B needs
Supabase dashboard access and is an operator/engineer task.

Each check has a **Record** line (write the actual value down) and a
**Pass/fail** line (what makes it pass). Anything marked **BLOCKER** must
pass before real client use — do not proceed past a blocker without fixing
it or getting sign-off from the tech lead.

> **Preset status: assumed, not physically verified.** The 50mm x 30mm /
> 300 DPI preset in [`src/lib/niimbot-m2-preset.json`](../src/lib/niimbot-m2-preset.json)
> has no recorded physical print test in this repo — no measurements,
> photos, or notes from a real M2 print. (An earlier version of that
> file's description claimed a June 30, 2026 verification; that claim was
> unsubstantiated and has been removed.) This checklist is the source of
> truth: once Section A passes, update `niimbot-m2-preset.json`'s
> description (and the numbers, if the measured size differs) to match
> the recorded result — not before.

### Release-candidate evidence snapshot — 2026-07-23

No physical or dashboard-only result is treated as passed in this snapshot.
The production deployment tested below was Vercel deployment
`dpl_8BXM4JSN2L6kYaXWMeUUvXWQhZ79`, commit `9cd7421`, in `READY` state and
aliased to `https://coffee.capturethis.com`.

| Check | Evidence collected | Result |
|---|---|---|
| Repository verification | 103/103 Node tests, ESLint, Next.js 16.2.11 production build, NIIMBOT export verifier, 24/24 Flutter tests, Flutter analysis, and signed App Store IPA build passed | Verified locally |
| Dependency audit | Next.js core security findings cleared after the local 16.2.11 patch; three high findings remain in Next-bundled PostCSS/Sharp | Failed; requires upstream patch or explicit documented risk decision |
| iOS handoff candidate | `1.0.0 (6)`, bundle `com.capturethis.ctcprinter`, iPhone-only, signed App Store IPA SHA-256 recorded in `release-evidence-1.0.0.md` | Verified locally; TestFlight upload pending |
| Print/sync recovery | Durable per-order states prevent automatic reprint after physical success; the operator can retry sync only or resolve uncertain output after inspection | Verified by automated state-machine tests; physical interruption test pending |
| Mobile security/reliability | HTTPS-only public links, Keychain session migration, bounded/time-limited API requests, sanitized errors, app-resume reconnect, single-printer and M2_H validation | Verified by analysis and automated tests; BLE behavior pending hardware |
| Label PNG contract | Server renderer test and export verifier both confirmed PNG output at `591 x 354px`; queue tests cover captured, skipped, off-set, cross-production, mismatched-person, and already-printed cases | Verified automatically; physical size remains unverified |
| Signed-out operator routes | `/productions`, `/people`, `/labels`, and `/productions/new` each returned `307` to `/login?next=...` | Verified against deployment |
| Missing public tokens | Production GET, label-queue GET, label-PNG GET, and order PATCH returned sanitized `401` responses | Verified against current deployment |
| Public Supabase configuration | The deployed login assets contained exact matches for the configured public Supabase URL and anon key; no values were printed or recorded | Verified against deployment |
| Service-role API configuration | The deployed invalid-token requests reached the token lookup and returned `403`, which would not occur if the server-only URL/key configuration failed | Operationally verified; hosting-dashboard name/value check still required |
| Anonymous direct Supabase access | Against the same public URL/key delivered by the deployment, anonymous selects on all seven core tables plus the required `orders` update returned HTTP `401` / Postgres `42501` | Verified against deployment configuration |
| Migration ledger and Realtime publication | Repository migrations end at `20260706120000_enable_orders_realtime.sql`; no Supabase dashboard/database-admin session was available to inspect applied migration history or publication membership | Unverified on deployed database |
| Privacy and support routes | Both current live routes returned HTTP 200 | Verified live; owner wording attestation pending |
| Signed-in operator and valid/expired/revoked token flows | No safe current credential/token fixture was used; a fictional fixture is specified in `review-production-fixture.md` | Unverified |
| CTC Printer, NIIMBOT, and fallback physical output | No iPhone, installed CTC Printer build, loaded stock, or NIIMBOT was available to this audit | Unverified |

Current sync behavior is intentional: the authenticated operator production
board listens to Supabase Realtime order changes as a notification only and
keeps a 10-second polling fallback. Both signals refresh production-scoped
Server Component data; pending optimistic order edits win during prop
reconciliation. The public token runner still uses a 10-second public API poll
and never receives direct Supabase table access.

Phase 5 moved signed-in operator table reads and writes behind request-scoped
anon-key server clients and authenticated Server Actions. The service role is
still exclusive to token-scoped public runner/printer APIs. Browser Supabase
use remains intentional for auth/session observation, Realtime notification,
and person-photo Storage; person table updates after a photo upload use the
Server Action boundary.

### Minimal remaining owner and hardware handoff

1. In Vercel **Project Settings > Environment Variables**, confirm all three
   names in B1 target Production. If the service-role value is made available
   to an authorized reviewer, compare it against downloaded client artifacts
   with a script that prints only pass/fail—never the value or a fragment.
2. In the Supabase SQL editor, run the B2 and B4 queries, including the
   `supabase_realtime` publication check, then perform one reversible
   authenticated setup write and undo it.
3. Sign in as an intended operator and complete B3. Create a disposable active
   production/token and complete B5 in a private window; revoke that token at
   the end.
4. Approve the release privacy/support wording and rotate the temporary
   credential identified during this audit before granting further access.
5. Run `docs/physical-release-test.md` with build 6, a real iPhone, the M2_H,
   actual stock, and the fictional production. Do not update the preset from
   automated pixel evidence alone.

---

## Section A — CTC Printer and NIIMBOT M2 validation (on set, phone + printer)

**Who runs this:** PA / label operator. No engineering background needed.

**What you need:**
- A physical iPhone with CTC Printer installed.
- A runner share link for an active production.
- A signed-in web session for fallback `/labels` testing.
- The NIIMBOT M2 printer, powered on.
- The actual label roll currently loaded in the printer.
- A ruler or tape measure.

### A1. Read the physical label roll — BLOCKER

Steps:
1. Open the printer and look at the roll that is actually loaded.
2. Measure the label width and height in millimeters.
3. Note whether labels are die-cut (individual rectangles/shapes with gaps) or one continuous strip.
4. Note the stock finish (matte white, glossy, holographic silver, etc).

**Record:**
- Measured width: _____ mm
- Measured height: _____ mm
- Die-cut or continuous: _____
- Stock finish: _____

**Pass/fail:** Pass if measured width x height matches the app's current
assumed preset of **50mm x 30mm**. Fail (blocker) if it does not match —
stop and flag to the tech lead before printing further tests, since every
downstream export assumes this size.

### A2. Print one label through CTC Printer — BLOCKER

Steps:
1. Confirm the production is `active`.
2. Open CTC Printer on the iPhone.
3. Paste or reuse the runner share link (`/run/{id}?token=...`).
4. Force-quit the official NIIMBOT app before connecting.
5. Connect the NIIMBOT M2_H.
6. Refresh the queue.
7. Print one real order label.
8. Confirm CTC Printer marks the order `label_printed`.
9. Refresh the web runner board and confirm the same order shows printed state.

**Record:**
- Phone model / OS: _____
- CTC Printer build/version: _____
- Queue loaded? Y/N
- Printed order/person: _____
- Correct orientation and no cropping? Y/N
- BLE stayed connected through queue refresh, print, and sync? Y/N
- `label_printed` visible in web app after refresh? Y/N

**Pass/fail:** Pass if the queue loads, the label prints legibly, CTC Printer
does not hang or drop BLE, orientation/cropping are correct, and
`label_printed` is visible back in the web app. Fail (blocker) if any of those
steps fail.

### A3. Validate `/labels` fallback PNG export

Steps:
1. Open `/labels` on the phone.
2. Choose the correct production.
3. Select one active label.
4. Confirm the on-screen preview is readable at a glance — name legible, drink text not cut off.
5. Tap **Share** if the button is available, otherwise tap **Export PNG**.
6. Confirm the file actually lands somewhere you can open it (Photos, Files, or the share sheet target).
7. Optionally import the PNG in the official NIIMBOT app and print one fallback test label.

**Record:**
- Browser used: _____
- Share available? Y/N
- Which path used (Share / Export PNG): _____
- NIIMBOT app import/scaling setting used (fit / fill / stretch / manual mm): _____
- Final printed size (measure the actual print): _____ mm x _____ mm
- Cropped? Y/N — where: _____
- Blurry or too light? Y/N
- Centered / off-center: _____

**Pass/fail:** Pass if the fallback PNG exports or shares without an error, and
any optional NIIMBOT-app print is not cropped and is legible at arm's length.
Fail if fallback export is unavailable or produces a blank/cropped asset.

### A3a. Historical fallback: save-as-template + Batch Print timing

As a fallback, the NIIMBOT app has a separate batch mechanism from the CSV path in A5: it
lets you multi-select several already-saved templates in **My Templates**
and print them all in one pass via **Batch Print**. This step tests whether
that's fast enough to use for a full crew run of fully custom, on-brand
PNGs (see [docs/niimbot-m2-plan.md](niimbot-m2-plan.md) Path A). Source for
this app behavior: NIIMBOT in-app help center, doc id 4166 — not yet
confirmed against this specific M2 + app version.

Steps:
1. Export 3-5 different PNGs from `/labels` (different crew members).
2. For each one: import into the NIIMBOT app, then save it as a template in My Templates. Time how long this takes per cup, start to finish.
3. Once all are saved, open Batch Print, multi-select all of them, set copy count to 1 each.
4. Print the batch in one pass. Confirm each printed label matches the right person/drink — no mix-ups.

**Record:**
- Average time per cup for import + save-as-template: _____ seconds
- Extrapolated time for a 20-cup crew run (just the save step): _____
- Batch Print produced all labels correctly, no mix-ups? Y/N
- Any size or quality issues specific to the batch pass (vs. the single print in A3)? _____

**Pass/fail:** Pass if the save-as-template step is fast enough (tech
lead/PA judgment call, but flag if it's much over ~15-20 seconds per cup)
and Batch Print produces correct, uncorrupted output for the whole stack.
Fail if templates get mixed up, sizing breaks in batch mode, or the
per-cup save time makes this impractical for a real crew count. This affects
fallback viability only; CTC Printer remains the primary crew-run path.

### A4. Condensation / durability check

Steps:
1. Take the printed test label from A3 and put it on a cold cup with ice or a cold drink.
2. Let it sit for 5 minutes.
3. Check whether the text is still fully readable and the label hasn't lifted or smeared.

**Record:**
- Readable after 5 minutes? Y/N
- Any lifting, smearing, or fading? _____

**Pass/fail:** Pass if fully readable and adhered after 5 minutes. Fail if
text smears or the label lifts — this is a stock/ribbon issue to raise
with the tech lead, not something to fix by re-exporting.

### A5. Export and validate the fallback CSV batch path

Steps:
1. In `/labels`, select several (3+) active orders for the same production.
2. Tap **Export CSV**.
3. Open the downloaded CSV (in Files, Sheets, or Excel) and confirm it has two columns: crew name and drink, one row per selected person, with no garbled characters.
4. In the NIIMBOT app, open (or build) a batch/variable-data template with two fields matching those columns.
5. Import the CSV into that template.
6. Print the batch of test rows.

**Record:**
- CSV row count matches selection count? Y/N
- Any garbled/missing text in the CSV? _____
- NIIMBOT template name used: _____
- Batch print result (all rows printed correctly?): _____

**Pass/fail:** Pass if the CSV opens cleanly with correct name/drink pairs
and the NIIMBOT app prints the full batch without manual re-entry per row.
Fail if the app can't consume the CSV directly, or requires more than
trivial manual fixes per row — that's a workflow gap to flag before
relying on this for a full crew run.

### A6. Close out Section A (engineering follow-up, not on-set)

Once A1–A5 are done, hand the recorded values to whoever maintains the app:
- If the measured size in A1 differs from 50mm x 30mm, update
  `src/lib/niimbot-m2-preset.json` (`widthMm`, `heightMm`, `pixelWidth`,
  `pixelHeight`, `printableWidthPx`) and re-run `npm run verify:niimbot-export`.
- Update `docs/niimbot-m2-plan.md`, `docs/v1-readiness.md`, and
  `docs/label-image-export.md` with the final confirmed physical result so
  they agree with `niimbot-m2-preset.json` (resolve the conflict noted at
  the top of this doc).
- This is app-code work — do not do it standing on set with the printer.

---

## Section B — Production deployment validation (operator/engineer, Supabase dashboard + terminal)

**Who runs this:** Whoever has admin access to the Supabase project and the
hosting platform. Do this before the first paid client uses the app, and
again after any deploy that touches auth, RLS, or the public API routes.

### B1. Required environment variables — BLOCKER

Confirm these are set on the **deployed** environment (not just `.env.local`):

| Variable | Where used | Required value |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | browser + server | your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | browser + server | your Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | server only, `src/lib/supabase-server.ts` | your Supabase service role key |

**Record:**
- All three confirmed present in the hosting platform's env settings? Y/N

**Pass/fail:** Pass only if all three are set. Fail (blocker) if
`SUPABASE_SERVICE_ROLE_KEY` is missing —
the public runner API routes (`/api/public/productions/[id]`,
`/api/public/orders/[id]`) will not work without it.

Also confirm the service role key is never exposed to the browser. Use an
authorized local script to compare the exact value with downloaded client
assets while emitting only a boolean result. Do not paste the key or a fragment
into browser search, terminal output, chat, or documentation.

**Pass/fail:** Pass if the key does not appear in any browser-loaded
asset. Fail (blocker) if it does — this is a credential leak.

**Phase 4 result:** Partial. The two public values were confirmed in deployed
assets, and the server-only token lookup is operational. The Vercel connector
does not expose environment-variable names or secret values, the local Vercel
CLI had no login, and no service-role value was available for an exact browser
asset scan. Confirm the dashboard entries and perform the value-assisted scan
before marking B1 passed.

### B2. Database schema and migrations applied — BLOCKER

In the Supabase SQL editor, confirm:
1. `supabase/schema.sql` has been run.
2. Every file in `supabase/migrations/` has been run, in filename order
   (oldest timestamp first, currently ending at
   `20260706120000_enable_orders_realtime.sql`).
3. Obsolete print-station tables are gone:

```sql
select table_name from information_schema.tables
where table_schema = 'public'
and table_name in ('printer_devices', 'label_print_jobs', 'label_print_attempts');
-- expect 0 rows
```

Confirm the latest migration added `orders` to Realtime:

```sql
select schemaname, tablename
from pg_publication_tables
where pubname = 'supabase_realtime'
and schemaname = 'public'
and tablename = 'orders';
-- expect exactly 1 row: public | orders
```

**Record:**
- Migrations applied through: _____ (filename of latest)
- Obsolete tables query returned 0 rows? Y/N
- Realtime publication query returned exactly `public | orders`? Y/N

**Pass/fail:** Pass if the obsolete-tables query returns zero rows, the
publication query returns exactly `public | orders`, and every migration file
has been applied. Fail (blocker) if old print-station tables still exist, the
Realtime row is absent, or a migration is missing — runtime behavior and RLS
policies may be inconsistent.

**Phase 4 result:** Unverified on the deployed database. The repository end
point is corrected above, and the deployed share-token table is operational,
but applied migration history, obsolete table absence, and Realtime publication
membership require Supabase database-admin access.

### B3. Operator auth checks

Steps:
1. In Supabase, disable public sign-ups under Authentication settings. Confirm
   the public `/auth/v1/settings` response reports `disable_signup: true`.
2. Go to **Authentication > Users** and confirm the intended
   operator user exists.
3. Sign in at `/login` as that user. Confirm it redirects to `/productions`.
4. While signed in as that operator, open `/people`, `/labels`, and
   `/productions/new` directly. Confirm all load (not redirected to `/login`).
   Every signed-in user has full access per `src/lib/auth.ts`; admin/staff
   `app_metadata` is historical and no longer required.
5. Sign out. While signed out, try opening `/people` directly. Confirm it redirects to `/login`.
6. If you have a second Supabase user, sign in as them and confirm they have the
   same full app access. Use Supabase invite/sign-up controls, not app metadata,
   to decide who can access the app.

**Record:**
- Public Auth settings report `disable_signup: true`? Y/N
- Operator user exists? Y/N
- Protected routes load for signed-in operator? Y/N
- Protected routes redirect for signed-out visitor? Y/N
- Second signed-in user has full app access, if tested? Y/N

**Pass/fail:** Pass if public registration is disabled, signed-in users can use
the app, and signed-out visitors are redirected. Fail if Supabase reports
`disable_signup: false` or a signed-out visitor can reach `/people`, `/labels`,
or `/productions/new` and perform setup writes.

**Release-candidate result:** Partial. On 2026-07-23 the live Supabase Auth
settings endpoint returned `disable_signup: true`, and the listed operator
routes redirected signed-out requests to `/login`. Signed-in route loading,
individual invitations/removal, and second-user access remain unverified.

### B4. RLS checks — BLOCKER

Run this exact block in the Supabase SQL editor (from `README.md`):

```sql
set local role anon;
select * from public.people limit 1; -- expect: permission denied
select * from public.orders limit 1; -- expect: permission denied
update public.orders set status = 'confirmed' where true; -- expect: permission denied
reset role;
```

Also confirm, as a signed-in authenticated user, that setup writes to `clients`,
`people`, `productions`, `production_roster`, and `orders` are allowed according
to the current full-access policy. This intentionally differs from older
admin-only RLS language.

**Record:**
- All three `anon` queries returned "permission denied"? Y/N
- Signed-in authenticated setup write accepted? Y/N

**Pass/fail:** Pass only if every anonymous query above is denied exactly as
shown and signed-in setup writes work. Fail (blocker) if any anonymous
read/write succeeds — this means direct table access is open and the
token-scoped API routes are not the only way in.

**Phase 4 result:** Partial. External anonymous REST requests using the same
public Supabase URL/key delivered by the deployed app returned HTTP `401` with
Postgres code `42501` for selects on `clients`, `people`, `client_people`,
`productions`, `production_share_tokens`, `production_roster`, and `orders`, as
well as the required `orders` update. The authenticated setup write still
requires a signed-in user or SQL editor session.

### B5. Public runner share-token flow — test on a second device — BLOCKER

This is the flow real runners use on set, so test it exactly as a runner
would: on a **second device**, in a **private/incognito window**, with
**no admin session**.

Steps:
1. On the signed-in operator device, in the Supabase SQL editor, generate a token for a real (or test) production:
   ```sql
   select public.create_production_share_token(
     '<production-id>'::uuid,
     now() + interval '14 days',
     'Readiness test link'
   );
   ```
2. On the second device, open `/run/<production-id>?token=<returned-token>` in a private window (not signed in).
3. Confirm the runner board loads: roster, names, drink orders visible.
4. Confirm private fields are **not** present — dietary notes and person notes should not appear anywhere in the runner view (check by comparing to a person you know has notes set in `/people` while signed in).
5. Confirm `usual_order` **does** show, since it's the intentional operational prompt.
6. Capture or edit an order (or mark **No drink**). Confirm it saves and persists after a refresh.
7. Edit a drink field (e.g. `drink_type`) from the second device. Confirm it saves.
8. Try to load the same URL with an obviously wrong token (e.g. change one character). Confirm it fails with an error, not silent access.
9. If you have a way to test it: mark the production `complete` as a signed-in operator, then retry a status tap from the second device. Confirm the PATCH is rejected ("Production is not active").
10. Revoke the token (`update production_share_tokens set revoked_at = now() where id = '<id>'`) and retry the runner link. Confirm access is now denied.

**Record:**
- Runner board loaded on second device without login? Y/N
- Dietary/private notes absent from runner view? Y/N
- `usual_order` present? Y/N
- Status tap and drink edit both saved and persisted after refresh? Y/N
- Wrong token rejected? Y/N
- Patch rejected once production is `complete`? Y/N
- Revoked token rejected? Y/N

**Pass/fail:** Pass only if every item above is Y. Fail (blocker) on any
N — this is the primary access path runners use on shoot day, and any gap
here is a data exposure or an on-set outage risk.

**Phase 4 result:** Partial. Missing and invalid tokens were rejected with
`401` and `403` respectively by the deployed production GET, queue GET,
label-PNG GET, and order PATCH boundaries; the runner page returned `404` for
both. A valid token, private-field omission on real data, persistence,
completed-production rejection, and revocation require a disposable production
plus operator/Supabase access.

---

## Sign-off

| Section | Result | Signed off by | Date |
|---|---|---|---|
| A — NIIMBOT M2 label validation | Not run — hardware required | | 2026-07-23 audit |
| B — Production deployment validation | Partial — B1/B2/B3/B4/B5 manual items remain | | 2026-07-23 audit |

Do not treat Capture This Coffee as ready for paid client use until both
sections pass in full. Partial passes with recorded exceptions must be
explicitly approved by the tech lead before a live shoot.
