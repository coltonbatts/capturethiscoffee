# Capture This Build 10 release validation

Last updated: 2026-07-27 17:31 CDT

Status: **INTERNAL TESTFLIGHT CANDIDATE — Build 10 is available internally.
External review, Build 10 physical acceptance, and printer handoff remain
open.**

**Gate 3 (unattended ten-label batch) is recorded as FAILED, not pending.** Two
`Print all` runs stopped on the batch's own first label. The owner decided on
2026-07-27 to accept single-label printing as the supported operating mode,
record the batch restriction as a documented product limitation, and continue
validating the remaining gates rather than debug the print path in this
engagement. See "Gate 3 failure record and batch-print diagnosis" below.

This is the live orchestration record for the remaining Build 9 physical exit
gate and the Build 10 disposable-project acceptance. It records only observed
evidence. An automated or source-level pass is never promoted to a physical
pass.

The current production-configured Build 10 worksheet, hardware mailing gate,
and buddy pilot are maintained in
[`build-10-pilot-handoff-2026-07-27.md`](build-10-pilot-handoff-2026-07-27.md).
The disposable project used for Build 9 baseline work cannot be reached by the
uploaded production-configured Build 10 IPA.

## Verified starting point

| Item | Observed evidence | Status |
|---|---|---|
| Source | Build 10 app implementation `fea2fc3e0f8cb4a8039eade6f2d8362fd681a943`; clean archive source `ab5edb8bc6d0bf582746b81e1815dd0574a83320` on `main`, with only release-evidence changes after the app commit | Verified |
| Remote | Archive-time `origin/main` matched `ab5edb8bc6d0bf582746b81e1815dd0574a83320` | Verified |
| Build 10 package state | `mobile/build/ios/ipa-build10/ctc_printer.ipa` is `1.0.0 (10)`, 23,128,931 bytes, SHA-256 `7a578953a32c5437f082392141b06559bce81eaab7252657ee9aa2366e9e30b7`; Apple Distribution signed with production host present and disposable host absent | Verified and uploaded |
| TestFlight state | Xcode upload succeeded at 4:24 PM CDT; Apple/TestFlight reported Build 10 available to the existing internal tester at 4:26 PM CDT | Ready to test |
| Connected phone | Physical iPhone 16, iOS 18.7.2, paired with developer mode enabled | Available |
| Preserved installed app | `com.capturethis.ctcprinter` reports `1.0.0 (9)` on the connected phone | Production-configured provenance app; prohibited for acceptance writes |
| Isolated validation app | Exact detached Build 9 `47c4405`, release mode, bundle `com.capturethis.ctcprinter.build10validation`; signed AOT contains the disposable hostname once and production hostname zero times | Installed directly and in active physical use; no archive, IPA export, or upload |
| Preserved Build 9 target audit, 12:03 CDT on 2026-07-27 | The Dart AOT framework inside the preserved Build 9 IPA contains the production Supabase hostname and not the disposable hostname | **Unsafe for acceptance writes.** It remains provenance evidence only |
| Printer / firmware / ribbon / stock | Photo and direct connection confirm `M2_H-I409130491`, 50×30 mm rectangular holographic stock, and unchanged ribbon; firmware and exact consumable brand/lot remain unknown | Printer/stock identity partly verified; missing firmware and brand/lot remain evidence limitations |
| Disposable remote Supabase target | `capture-this-build10-disposable` / `svqxznvyrbmbqihekkwo`, explicitly authorized by the owner on 2026-07-27; CLI reports active and healthy | Identity verified |
| Flutter regression, 18:48–18:49 CDT | `flutter pub get`, `flutter analyze`, and 158/158 `flutter test` cases passed | Verified |
| Frozen-web regression, 18:48–18:49 CDT | 105/105 `npm test` cases, lint, Next.js 16.2.11 production build, and NIIMBOT export verification passed | Verified |
| Post-verifier regression, completed 11:59 CDT on 2026-07-27 | After adding the remote-safe verification script: Flutter analysis and 158/158 tests passed; frozen-web 105/105 tests, lint, production build, and NIIMBOT export verification passed | Verified |
| Post-fixture-tool regression, completed before 12:20 CDT on 2026-07-27 | After adding the guarded fixture manager: Flutter analysis and 158/158 tests passed; frozen-web 105/105 tests, lint without warnings, production build, and NIIMBOT export verification passed | Verified |
| Exact Build 9 detached source | Temporary detached worktree at `47c440556da52e7e59ab81b7fd77186087013331`; clean after dependency resolution, `flutter analyze` clean, 140/140 tests passed, `niim_blue_flutter` remains 1.0.1 | Installed directly in the isolated disposable validation bundle |
| Geometry | 591×354 PNG, 18 px safe margin, 567 px effective printable width | Verified and unchanged |
| Local Supabase, completed 18:53 CDT | Clean Supabase CLI 2.109.1 stack loaded from pre-Build-10 commit `6e54cc5`, the orders-Realtime migration, and the Build 10 printed-fact migration | Passed and removed |

The local Supabase verifier used generated `example.test` accounts and fictional
rows. It observed anonymous refusal, authenticated RLS read/write, a successful
then refused stale order CAS, a successful then refused stale usual-order CAS,
irreversible `label_printed: true`, and a filtered authenticated Realtime
`UPDATE`. Its fixture was deleted, the local stack was stopped, and its
temporary work directory was moved to Trash.

## Validation takeover recheck — 2026-07-27 12:32 CDT

- Local `HEAD`, `main`, `origin/main`, and the remote `main` ref all resolve to
  `fea2fc3e0f8cb4a8039eade6f2d8362fd681a943`.
- The only main-worktree changes are the five modified and three untracked
  validation files named in the handoff. No shipping source change, commit, or
  push was made.
- The detached Build 9 worktree still exists at
  `/tmp/capture-this-build9-physical.iBY4NX/worktree`, is clean at exact
  `47c440556da52e7e59ab81b7fd77186087013331`, and still pins
  `niim_blue_flutter: 1.0.1`.
- Every local Xcode archive and IPA inspected is Build 9 or older. The preserved
  `mobile/build/ios/archive/Runner.xcarchive` and
  `mobile/build/ios/ipa/ctc_printer.ipa` both report `1.0.0 (9)`; no Build 10
  archive or IPA is present.
- All five named Build 10 Keychain items are present and non-empty. Values were
  retrieved only into non-echoed shell variables and were not printed or
  written to a file.
- The physical iPhone 16 on iOS 18.7.2 is paired, booted, unlocked, and has
  Developer Mode enabled. Its installed Capture This app still reports
  `1.0.0 (9)`.
- No app was installed or launched, no remote verifier or migration was rerun,
  no fixture row was changed, and no physical gate was promoted. Printer,
  firmware, ribbon, stock, cold-cup, and independent-operator readiness still
  require owner confirmation.

## Second validation takeover recheck — 2026-07-27 14:43 CDT

Claude Code took over release validation and reconfirmed the environment before
touching anything. All checks below are read-only; no install, launch, write,
migration, commit, push, or packaging occurred.

- Local `HEAD`, `main`, and `origin/main` all resolve to
  `63c95da74abe8dcceadab887ef71af01cad8b437` (`Record Build 10 release
  validation`). The main worktree is clean with no untracked files. Build 10
  application source remains `fea2fc3e0f8cb4a8039eade6f2d8362fd681a943`; the
  newer commit adds validation documents and guarded tooling only.
- The detached Build 9 worktree at
  `/private/tmp/capture-this-build9-physical.iBY4NX/worktree` is still clean at
  exact `47c440556da52e7e59ab81b7fd77186087013331`, still declares
  `version: 1.0.0+9`, and still pins `niim_blue_flutter: 1.0.1`. The main
  worktree declares `version: 1.0.0+10` with the same pinned printer library.
- The physical iPhone 16 (`iPhone17,3`) is `connected` to this Mac. Both
  `com.capturethis.ctcprinter.build10validation` and the preserved
  `com.capturethis.ctcprinter` report `1.0.0 (9)`. The isolated validation
  bundle is the only acceptance target.
- The five named Keychain items under account `capture-this-build10` are
  present and non-empty. Values were read only into non-echoed command
  substitutions, were never printed, and were never written to a file. The
  disposable API URL is derived from the recorded ref rather than stored as a
  secret.
- Read-only authenticated fixture inspect at 14:41 CDT, through Account A's
  public RLS session against `svqxznvyrbmbqihekkwo` only:

  | Fixture day | Status | Roster | Orders | Captured + unprinted | Not asked |
  |---|---|---|---|---|---|
  | Build 9 · Ten Label Batch | active | 11 | 11 | **10** | 0 |
  | Build 9 · Recovery Active | active | 12 | 12 | 10 | 0 |
  | Build 10 · Acceptance Active | active | 24 | 24 | 0 | 24 |
  | Build 10 · Planning Refusal | planning | 1 | 1 | 1 | 0 |
  | Build 10 · Complete Refusal | complete | 1 | 1 | 1 | 0 |

- The batch day's ten unprinted order IDs match the documented rerun map
  exactly. Fictional Operator 01 (`4ac691a3-8129-44d3-b3d3-4c574a566290`)
  remains irreversibly printed at revision
  `2026-07-27T19:03:36.09936+00:00`. Operators 02–10 all still hold their
  original seed revision `2026-07-27T17:19:10.27894+00:00`, and Fictional Batch
  Replacement 11 holds `2026-07-27T19:05:49.715755+00:00`. No row was touched.
- On the Recovery day, the two printed rows are the spoiled Operator 11
  (`5f3448ff-…`) and the legitimately printed Operator 12 (`2edd27a4-…`). Ten
  unprinted recovery rows remain available as fresh rows for later retryable
  physical cases.
- The `supabase-postgres-best-practices` skill named in the handoff is **not
  installed** in this environment; the official Supabase plugin directory is
  empty and the skill is not registered. Its substance is applied manually
  instead: public anon/publishable key only, RLS-scoped user sessions, no
  service-role key, no direct database password, conditional
  `updated_at` compare-and-swap writes, and no production access. This is
  recorded as a tooling limitation, not a skipped check.

## Disposable Build 9 device install — 2026-07-27 12:40 CDT

- The owner confirmed that the physical phone was unlocked, attached to this
  Mac, and connected to the M2 printer.
- Because the existing production-configured app's Supabase and Legacy
  sessions use fixed Keychain keys, the exact `47c4405` source was built under
  the isolated temporary development bundle
  `com.capturethis.ctcprinter.build10validation`. This preserves the existing
  production-configured app and prevents its session, Legacy link, cache, and
  recovery state from entering disposable acceptance.
- The non-installing unsigned preflight reported `1.0.0 (9)`, contained the
  disposable hostname `svqxznvyrbmbqihekkwo.supabase.co` once in the Dart AOT
  framework, contained production hostname
  `lehwhehssjfudyrtljus.supabase.co` zero times, and left the detached worktree
  clean.
- A first manual-profile signing attempt failed before producing or installing
  an app because Xcode-managed wildcard profiles cannot be manually assigned
  across dependency targets. The retry used automatic local profile selection
  without provisioning-update permission and succeeded with the already
  installed `iOS Team Provisioning Profile: *`.
- The signed app again reported `1.0.0 (9)`, the isolated bundle ID, a valid
  `YW8K4837YB.com.capturethis.ctcprinter.build10validation` application
  identifier, one disposable-host occurrence, and zero production-host
  occurrences.
- The signed app was installed side-by-side at 12:40 CDT and launched directly
  by its isolated bundle ID. No archive or IPA was created, the existing
  `com.capturethis.ctcprinter` installation remains present, and no Supabase
  write has yet been made.
- At 12:43 CDT the owner confirmed that the launched app showed a clean sign-in
  surface with no restored day, person, board, or Legacy data. The disposable
  Account A sign-in then succeeded. At 12:45 CDT the owner confirmed that the
  Days screen showed exactly the five fictional Build 9/Build 10 fixture days
  and no real client, production, person, or Legacy data.
- The Account A email and password were transferred one field at a time through
  the Mac clipboard from non-echoed Keychain command substitutions. The
  password was not printed or written to a file, and the clipboard was cleared
  immediately after sign-in.
- The authenticated disposable-target check passes. No physical gate is passed
  by the install, clean start, sign-in, or fixture visibility alone.
- The temporary unsigned output was removed with `flutter clean`; the signed
  Xcode-derived directory was moved to the recoverable macOS Trash after
  installation. The detached Build 9 worktree remains clean.
- At 12:48 CDT the owner supplied a physical printer photo. The printer display
  clearly reports device ID `M2_H-I409130491`, confirming the M2_H model, and
  rectangular holographic stock is visibly loaded. Exact Build 9 source uses
  density `3`.
- The supplied photo is **not** accepted or copied into release evidence
  because the label visible in it is not from the disposable fixture and may
  contain real personal data. Firmware, ribbon details, stock
  brand/lot/measurements, tester identity, and the intended operator's presence still require a
  direct record.
- The owner identified the tester as Colton, the developer/builder. the intended operator is not
  present, so the independent-operator gate remains open and cannot be inferred
  from Colton's run.
- The owner reports the loaded stock is 50×30 mm and that the unchanged ribbon,
  printer connection, cold cup, nearby-app/printer preparation, and remaining
  physical setup are ready. The visible stock is rectangular and holographic.
  Exact ribbon brand/lot and stock brand/lot were not supplied.
- Firmware is unknown and was not updated. The missing firmware record remains
  an evidence limitation; it is not silently treated as a recorded firmware
  pass.
- At 12:55 CDT Colton selected the disposable **Build 9 · Recovery Active**
  day. The app displayed exactly 12 labels to print, the printer was connected,
  and the print action turned yellow/enabled. No label had yet been printed or
  fixture row consumed. The authenticated force-quit restoration is next.
- Fictional screenshot
  `/Users/coltonbatts/Downloads/Screenshot 2026-07-27 at 12.59.39 PM.jpeg`
  records the successful Airplane Mode cold start: Recovery Active, visible
  `Offline` state and cached-day warning, 12 labels to print, connected
  `M2_H-I409130491`, and Fictional Operator 11 next. It contains only the
  disposable fixture and no credential.
- Fictional Operator 11 maps to recovery order
  `5f3448ff-97ef-4bd1-a718-8f56021dbc4c`, person
  `e806f66c-a68a-4b35-bab3-41ed10b2d635`, and drink
  `Fictional validation latte 11`. A read-only authenticated fixture snapshot
  at 12:58 CDT confirmed all 12 recovery rows still had
  `label_printed: false`.
- Colton briefly restored Wi-Fi only to transfer the screenshot. No label had
  been printed, so the offline print case was not consumed; Airplane Mode must
  be re-enabled before the printed-but-unsynced label.
- After Airplane Mode was re-enabled, Colton reported a good physical label
  and success haptic, but also reported that the app showed 10 labels left
  rather than the expected 11. No pass was inferred from that report.
- A read-only copy of the isolated app's fictional-only preferences and a
  hosted fixture query established the exact state:
  - `5f3448ff-97ef-4bd1-a718-8f56021dbc4c`, Fictional Operator 11, entered
    local `uncertain` recovery at 13:03:32 CDT.
  - `2edd27a4-c831-42be-913e-62754ccae4ce`, Fictional Operator 12, entered
    local `printedNeedsSync` recovery at 13:04:11 CDT.
  - Hosted Supabase still reports all 12 recovery orders
    `label_printed: false`.
- The 12→10 count therefore reflects two distinct local attempts. The phone
  remains offline and no recovery choice may be made until Colton inspects all
  physical output and reports which fictional label or labels actually
  emerged. Operator 12 must never be physically reprinted; Operator 11 remains
  uncertain until inspection.
- Colton then completed the physical inspection: the first attempt for
  Fictional Operator 11 produced no paper; the second attempt produced exactly
  one usable Fictional Operator 12 label. Operator 11 therefore requires
  **Nothing printed — retry**; Operator 12 requires **Label printed — sync
  only** and must never be reprinted.
- Colton reported the Operator 12 label was readable/aligned and the success
  haptic was felt. The label was assigned to the cold-cup check with its
  five-minute clock starting at 13:08 CDT. Airplane Mode remains enabled.
- Colton force-quit the app offline, and the exact isolated bundle was
  relaunched at 13:12 CDT. He confirmed both distinct records returned with
  their correct actions: Operator 11 remained uncertain/retry and Operator 12
  remained printed/sync-only. Durable recovery persistence across a real
  offline process death passes; neither hosted row had yet been changed.
- After connectivity returned, Codex incorrectly described the recovery-button
  wording in the operator instruction. Colton selected **Label printed — sync
  only** on the uncertain Operator 11 record even though physical inspection
  had established that no Operator 11 paper existed. This was the wrong
  recovery action.
- Operator 11 is therefore a spoiled disposable row and is permanently excluded
  from physical-pass evidence. Its printed fact must never be reset; the
  monotonic database trigger is working as designed. Use a fresh recovery row
  for every later retryable case.
- Operator 12, whose physical label does exist, remains visible with the
  correct **Sync only** action. It must be synchronized with the printer
  disconnected and no second physical label.

## Verified acceptance-design findings — 2026-07-27

- `orders_preserve_label_printed` is a `BEFORE UPDATE OF label_printed` trigger
  with no role exception. A normal PostgREST update cannot reset a true printed
  fact, including one authenticated with the service-role key. RLS bypass is
  not trigger bypass. Deliberately disabling the trigger or using a privileged
  replication-mode database session is outside the accepted test/application
  path.
- Therefore, never plan to recycle a printed order after a spoiled label or
  aborted batch. Seed several extra fictional captured/unprinted orders and
  consume a fresh row for each retryable physical case.
- `orders_set_updated_at` is a `BEFORE UPDATE` trigger on every order update and
  always writes `now()`. A silent second replay that rewrites even identical
  ordinary values advances `updated_at`. T1 and T2 equality is therefore an
  active no-replay proof; any unexplained T2 revision advance is a failure, not
  harmless timestamp noise.
- `scripts/verify-build10-local-supabase.mjs` deliberately calls local
  `supabase status`, requires a `localhost` or `127.0.0.1` API host, and uses
  the local stack's service-role key to create and remove its fixture. Do not
  weaken those guards or point that script at a remote project.
- Remote acceptance uses the separate
  `scripts/verify-build10-remote-supabase.mjs` verifier. It hardcodes the
  explicitly approved disposable and known production refs, refuses every
  other host, rejects service-role/secret keys, uses only the public
  anon/publishable key plus two pre-created disposable user sessions, creates
  fictional rows, and removes those rows in cleanup. Its syntax,
  production-host refusal, and privileged-key refusal passed before any
  authenticated run.

## Exact Build 9 physical exit audit

Five checks are now directly passed and five remain open. Automated evidence
and prerequisite smoke observations are not promoted to physical passes.

| # | Exit check | Evidence already held | Exact status / missing observation |
|---|---|---|---|
| 1 | Online sign-in and selected-day restoration after force-quit | Colton force-quit the isolated disposable Build 9 after Account A selected Recovery Active with 12 labels, then the exact isolated bundle was relaunched at 12:55 CDT on 2026-07-27 | **Passed.** The authenticated account, selected day, and exact 12-label board restored without a sign-in prompt or unexpected recovery. BLE did not persist across process death and required explicit reconnection |
| 2 | Airplane-mode authenticated cold start | Colton force-quit Build 9, enabled Airplane Mode with Bluetooth retained, and the exact isolated bundle was relaunched at 12:57 CDT on 2026-07-27 | **Passed.** Account A, Recovery Active, the exact 12-label cached board, and offline/staleness state restored without unexpected recovery; `M2_H-I409130491` reconnected with only Bluetooth available and the 12-label print action enabled |
| 3 | Ten-label M2_H batch | Two runs attempted. 13:19 CDT stopped on Operator 01 waiting `0x04` `inPageStart` with no paper. 15:44 CDT stopped on Operator 02 waiting `0xe4` `inPageEnd` after one label emerged. Both stopped on the batch's own first label; neither advanced past it | **FAILED.** Not achievable on current hardware/firmware/consumables. Root cause not isolated. Owner accepted single-label printing as the supported mode on 2026-07-27 and recorded unattended batch printing as a documented limitation |
| 4 | BLE interruption and uncertain-print recovery | Two organic uncertain outcomes now cover **both** physical branches. 13:19 CDT Operator 01: `inPageStart` timeout, no paper, resolved with **Nothing printed — retry**, produced exactly one label. 15:44 CDT Operator 02: `inPageEnd` timeout, paper emerged, pending resolution via **Label printed — sync only** | **Open.** Both branches are covered organically and the protocol stage matched the physical result each time, but the prescribed *deliberate* interruption and its unobserved uncertain haptic remain open |
| 5 | Printed-but-unsynced **Sync only** recovery | Fictional Operator 12 physically printed offline at 13:04 CDT, persisted as `printedNeedsSync` across force-quit/relaunch, and was resolved after connectivity returned with the printer disconnected | **Passed.** No duplicate paper emerged; hosted order `2edd27a4-c831-42be-913e-62754ccae4ce` is `label_printed: true` at revision `2026-07-27T18:15:38.512892+00:00`; the local recovery ledger is empty. The separately spoiled Operator 11 row is excluded |
| 6 | Two-account cache isolation | With Account A's Operator 01 uncertain record deliberately left unresolved, Colton signed out and authenticated as Account B. Account B opened on a clean **Choose a day** screen, inherited neither Account A's selected-day pointer nor its unresolved-label state, and legitimately saw the shared hosted ten-label day as 0/10 printed. After returning to Account A, the exact red **Batch stopped at Fictional Operator 01** state and nine-label queue returned only there | **Passed.** Account-scoped selected-day and recovery state remained isolated while shared hosted fixture data remained correctly visible to both accounts |
| 7 | Planning/complete-day print refusal | Widget/controller refusal tests pass | **Open.** No physical-device refusal for both statuses; Build 10 pending-write replay refusal also remains to be observed |
| 8 | Haptics and Reduce Motion | Reduce Motion widget tests pass; simulator cannot prove haptics. At 15:44 CDT an uncertain print fired the double-beat path, but Colton was not holding the phone and **did not observe it**. Recorded as not observed — neither a pass nor a fail | **Open.** Success and uncertain haptics are still not physically distinguished, and Reduce Motion has not been inspected on the iPhone |
| 9 | Cold-cup adhesion and readability | Fictional Operator 12's 50×30 mm holographic label was applied to a cold cup from 13:08 through at least 13:16 CDT | **Passed.** Colton directly inspected it and reported no lift, smear, fade, contrast, or readability issue. A fictional-only evidence photo has been requested |
| 10 | Independent operator run | No evidence | **Open.** the intended operator has not completed the prescribed flow without Colton touching the phone or dashboard |

This table was the pre-upload gate. The owner later explicitly authorized the
Build 10 archive and internal-TestFlight upload with rows 4, 7, 8, and 10 still
open and Gate 3 closed as a failed, accepted limitation. That authorization
did not turn any physical row into a pass and does not authorize a replacement
binary.

Row 3 is closed as **failed with an owner-accepted limitation** rather than
passed. It no longer blocks progress through the remaining gates, but it must be
carried into the handoff as a stated restriction on supported operation, and it
must never be reported as a pass. Rows 4, 7, 8, and 10 remain genuinely open.

## Credential handoff and handling

Project identity, disposable authorization, CLI access, public app
configuration, and two created Auth users are confirmed. The public key and
both users' email/password pairs were placed into five named macOS Keychain
items by the owner. The values were retrieved only through non-echoing command
substitution, were not printed, and are not present in the repository. A
browser/dashboard login is optional if the owner wants to perform the physical
scenario's competing edit manually; Account B can otherwise perform it through
the authenticated acceptance tooling.

The app receives only the public URL and public anon/publishable key. Never
embed a service-role or `sb_secret_…` key in Flutter.

Before the first external write, record:

- Project display name: `capture-this-build10-disposable`
- Project ref: `svqxznvyrbmbqihekkwo`
- Owner statement that this target is disposable: Colton / 2026-07-27,
  recorded in the Codex task before external writes
- Production project ref, recorded only to prove it is different:
  `lehwhehssjfudyrtljus`
- Migration operator / fictional-row cleanup owner: Codex, within the owner's
  explicit authorization for disposable Build 10 acceptance
- Account A issued / Account B issued: yes / yes
- Account A and B authenticated through public-key sessions: yes / yes
- Supabase CLI login: confirmed by successful project listing at 11:41 CDT
- Public app key: supplied as a publishable key; not recorded in the repository

If any identity, authority, or credential is missing or ambiguous, stop before
linking the CLI, applying SQL, creating users, or seeding rows.

## Fictional physical fixture

The guarded public-key/user-session fixture manager seeded only unmistakably
fictional rows at 12:19 CDT on 2026-07-27. Cleanup requires the exact tag
`build10-20260727-a`; keep the fixture until all physical work and evidence
queries are complete.

| Fixture | Identifier / observed contents | Cleanup observed? |
|---|---|---|
| Client | `9e501eec-700b-4c81-9b13-938842dde7a5` | pending |
| Build 9 ten-label Active day | `498cefee-b43b-44cc-b60a-a4e610c38ce3`; 11 captured orders: Operator 01 printed and exactly 10 fresh unprinted orders | pending |
| Build 9 recovery Active day | `8ea731e6-dc4e-49b7-a83f-88a45d78a336`; 12 captured/unprinted orders | pending |
| Build 10 acceptance Active day | `93750900-7d8a-4958-baeb-75cdbb760ca4`; 24 on-set `not_asked` orders | pending |
| Planning day | `d3702777-8616-4a3b-a35f-cdd145ee4180`; one captured/unprinted order | pending |
| Complete day | `c8ed7032-5cf5-4b8d-afad-7b25cbe665cd`; one captured/unprinted order | pending |
| Account A / B | Credentials in Keychain; both authenticated and read the fixture | retain through physical run |
| Legacy link | Not created; create privately immediately before fallback testing | revoke pending |

The fixture was initially seeded with 24 fictional people and 48 orders.
Following the interrupted first batch, one uniquely named fictional replacement
person, roster entry, and unprinted order were added through Account A's public
RLS session at 14:05 CDT. It now contains 25 fictional people and 49 orders
total. Account B independently read the original five days and expected counts.
No real name, client, crew, order, photo, or production was inserted.

## Disposable-project migration gate

Run this only after the target above is explicitly identified.

1. Capture the project name/ref and a pre-migration query showing that the
   target is the approved disposable project.
2. Confirm migration
   `20260725120000_preserve_printed_order_facts.sql` is pending there.
3. Apply that migration to that project only.
4. Query `pg_trigger` and `pg_get_triggerdef` to verify
   `orders_preserve_label_printed` is enabled on `public.orders`.
5. Query `pg_publication_tables` to verify `public.orders` is in
   `supabase_realtime`.
6. On a fictional order, write `label_printed: true`, then attempt a full-row
   write containing `label_printed: false`; read back `true`.
7. Record migration output and sanitized SQL results without credentials.

Results:

- Target ref / timestamp: `svqxznvyrbmbqihekkwo` / 2026-07-27
  11:46 CDT
- Dry-run before application: passed; exactly the pre-Build-10 schema snapshot,
  orders-Realtime migration, and Build 10 printed-fact migration were pending
- Migration application: passed; remote migration history records
  `20260703110000`, `20260706120000`, and `20260725120000`
- Post-application dry-run: passed; remote database reported up to date
- Trigger definition/enabled: passed in the authenticated remote schema dump;
  `orders_preserve_label_printed` and `orders_set_updated_at` are present
- Core RLS definitions: passed in the authenticated remote schema dump
- Anonymous `orders` read: refused with HTTP 401 / Postgres `42501`
- Realtime publication: passed; authenticated remote schema dump contains
  `ALTER PUBLICATION supabase_realtime ADD TABLE ONLY public.orders`
- True-then-false functional proof: passed through authenticated disposable
  user sessions; `label_printed` remained true
- Remote-safe verifier: passed anonymous refusal, authenticated RLS read/write,
  successful then stale-refused order and usual-order writes, competing-edit
  preservation, irreversible printed facts, `updated_at` advancement on an
  identical update, and a filtered Realtime `UPDATE`
- Verifier cleanup audit: passed; exact transient remote client, person, and
  production prefixes each returned count zero
- Persistent physical fixture: seeded by
  `scripts/manage-build10-physical-fixture.mjs` with tag
  `build10-20260727-a`; Account B independently verified all counts
- Production untouched: confirmed by the temporary link and every command
  targeting only `svqxznvyrbmbqihekkwo`; production ref
  `lehwhehssjfudyrtljus` was never linked or mutated
- CLI note: migration application completed successfully, followed by a local
  pg-delta catalog-cache warning about a missing temporary certificate.
  Migration history, a second dry-run, and two remote schema dumps independently
  confirmed the database result.
- CLI cleanup: the temporary migration workspace was unlinked from the
  disposable project and moved to Trash at 12:01 CDT. This changed only local
  CLI state; it did not modify the disposable or production database.

## Build 9 exact ten-label batch map

A read-only authenticated preflight at 13:17 CDT reconfirmed that the exact
batch day is Active and contains exactly ten captured orders, all with
`label_printed: false` and initial revision
`2026-07-27T17:19:10.27894+00:00`.

The first **Print all (10)** attempt stopped at 13:19 CDT on Fictional Operator
01. The app reported that its outcome was uncertain after
`Timeout waiting for response (waited for 0x4)`, disconnected from
`M2_H-I409130491`, did not advance to Operator 02, and displayed nine labels
remaining. Screenshot evidence:
`/Users/coltonbatts/Downloads/IMG_FDFB4625B7CA-1.jpeg`. No recovery choice,
reconnect, or retry is permitted until the physical printer and stock are
inspected for a complete, partial, or absent Operator 01 label. A read-only
authenticated hosted audit at 13:22 CDT found all ten batch orders still
unprinted; Operator 01 remained `label_printed: false` at its initial revision.
That hosted state did not determine whether paper physically emerged. Colton
then directly inspected the printer and stock and confirmed that **no label at
all**—complete, partial, or extra—had emerged. The correct eventual recovery
choice is therefore **Nothing printed — retry**. The unresolved record is being
left intact first for the Account A/Account B cache-isolation check, with the
printer disconnected.

For the isolation check, Account A was signed out while the Operator 01
uncertain record remained unresolved. Account B then authenticated on the same
iPhone and opened on a clean **Choose a day** screen. It did not inherit
Account A's selected-day pointer or unresolved-label recovery state. It
legitimately saw the shared hosted Build 9 ten-label day as 0/10 printed,
matching the read-only hosted audit. The clipboard was cleared immediately
after Account B authentication. After signing out of Account B and returning
to Account A, the exact red **Batch stopped at Fictional Operator 01** state
and the nine-label remaining queue restored only in Account A. This completes
the physical two-account cache-isolation check.

With `M2_H-I409130491` reconnected, Colton chose the known-safe
**Nothing printed — retry** action. Exactly one complete Operator 01 label
printed. A read-only hosted audit at 14:04 CDT then found Operator 01
irreversibly `label_printed: true` at revision
`2026-07-27T19:03:36.09936+00:00`, with the other nine original batch rows
still unprinted.

To preserve the requirement for one uninterrupted ten-label run without ever
resetting a printed fact, a fresh fictional replacement was added to this same
Active day at 14:05 CDT. The operation used the exact disposable hostname,
Account A's public session, RLS, explicit pre/post count assertions, and
compensating cleanup on failure; it did not use a service-role key or access
production. The day now has 11 roster entries and 11 orders: Operator 01 is
printed and the following exact ten are unprinted.

| Rerun label | Fictional operator | Order ID | Drink | Result |
|---|---|---|---|---|
| 1 | Fictional Operator 02 | `1456b740-8cbf-4c64-b70f-6abac7349ec7` | Fictional validation latte 02 | **Uncertain at 15:44:48 CDT** — `inPageEnd` timeout, one physical label emerged, batch stopped here. Awaiting physical inspection and **Label printed — sync only** |
| 2 | Fictional Operator 03 | `420a4a22-8ec7-4437-a43a-389a15db2d12` | Fictional validation latte 03 | **Printed and synced** 15:56:49 CDT via the single-label action; hosted revision `2026-07-27T20:56:49.29934+00:00` |
| 3 | Fictional Operator 04 | `471efdc1-18ad-4cbc-a2b2-79e51f82aa20` | Fictional validation latte 04 | pending |
| 4 | Fictional Operator 05 | `ea0033f2-2a5a-4d90-87a2-22d8b187cf1f` | Fictional validation latte 05 | pending |
| 5 | Fictional Operator 06 | `439b0152-3aec-4dd7-80ed-f44f366c699c` | Fictional validation latte 06 | pending |
| 6 | Fictional Operator 07 | `c35b5f38-99f7-448f-a9ca-b13b9adbad75` | Fictional validation latte 07 | pending |
| 7 | Fictional Operator 08 | `77b02c67-41e3-4e20-a02d-a51ced33510b` | Fictional validation latte 08 | pending |
| 8 | Fictional Operator 09 | `dc17a0bd-641f-41c5-911c-f1b705a4b262` | Fictional validation latte 09 | pending |
| 9 | Fictional Operator 10 | `1802b680-c3e6-4332-b1c2-baecabdfc113` | Fictional validation latte 10 | pending |
| 10 | Fictional Batch Replacement 11 | `f8f95590-a854-4d39-a617-fd22ba013c6f` | Fictional validation latte 11 | pending; initial revision `2026-07-27T19:05:49.715755+00:00` |

Rerun labels 2–10 were **never attempted**. The 15:44 CDT run stopped at rerun
label 1 and the batch gate was then closed as failed by owner decision, so no
third attempt was made. Those nine rows remain untouched, unprinted, and at
their original seed revision `2026-07-27T17:19:10.27894+00:00`. They are
available as fresh single-print rows for the remaining gates; the Recovery day
holds ten more.

## Gate 3 failure record and batch-print diagnosis — 2026-07-27 15:52 CDT

### What happened

The second exact ten-label run started at approximately 15:44 CDT with the
refreshed batch day, ten unprinted rows, and a connected `M2_H-I409130491`.
Colton confirmed the queue and pressed **Print all (10)**.

One physical label emerged for Fictional Operator 02, then the batch stopped.
The app displayed:

> Batch stopped at: Fictional Operator 02 · build10-20260727-a — Medium, Hot,
> Fictional validation latte 02, Oat milk, Disposable test order 02
>
> Print all pending failed: The print outcome for Fictional Operator 02 ·
> build10-20260727-a is uncertain. Check the physical printer, then choose
> "Label printed — sync only" or "Nothing printed — retry." Timeout waiting
> response (waited for 0xe4)

The deck fell back to **Connect printer** with **Print all (9)** disabled,
confirming the uncertain branch's deliberate BLE teardown. The batch did not
advance to Operator 03.

### Exact device and hosted state

A read-only copy of the isolated app's preference container was taken at
15:46 CDT. It contains only fictional fixture data and no credential or session
material. The Build 9 ledger key `ctc_print_recovery_v1` held exactly one
record:

| Field | Value |
|---|---|
| Order | `1456b740-8cbf-4c64-b70f-6abac7349ec7` (Fictional Operator 02) |
| State | **`uncertain`** — not `printedNeedsSync` |
| Created | `2026-07-27T20:44:48.427775Z` = 15:44:48 CDT |
| Scope | `user:f08c47f8-…` / production `498cefee-…` |

A read-only authenticated hosted audit at 15:50 CDT confirmed Operator 02
remained `label_printed: false` at its original seed revision
`2026-07-27T17:19:10.27894+00:00`. Nothing reached Supabase. Only Operator 01
is printed on that day.

### Protocol diagnosis

`M2_H` resolves to the **B1 print task**
(`print_task_factory.dart`; `PrinterModel.m2H` is in the `PrintTaskName.b1`
list). The app treats every label as an independent session — `printInit()`,
`printPage()`, `waitForFinished()` with `totalPages: 1`, the heartbeat stopped
for the duration and restarted after, wrapped in a 60-second
`_printOperationTimeout`. Inside `printPage`, the pinned library sends
`pageStart` → image data → `pageEnd` and waits `pageTimeoutMs` = **10 000 ms**
for each acknowledgement.

The two awaited opcodes decode exactly, and each one predicted the physical
outcome that was actually observed:

| Attempt | Awaited | `commands.dart` name | Stage reached | Predicted paper | Observed paper |
|---|---|---|---|---|---|
| Operator 01, 13:19 CDT | `0x04` | `inPageStart` | printer never acknowledged starting the page | none | **none** — confirmed by inspection |
| Operator 02, 15:44 CDT | `0xe4` | `inPageEnd` | page started and image data sent; finish never acknowledged | paper already fed | **paper emerged** |

This agreement between protocol stage and physical result is positive evidence
that the app's uncertainty model is sound: it does not know the outcome, and it
is correct not to know it.

### What passed inside the failure

- The uncertain fact was durably recorded **before** the failure surfaced.
- The batch stopped at the failing label and named it, rather than continuing.
- BLE was torn down, forcing an explicit reconnect.
- Operator 03 and everything after it were left untouched and unprinted.
- No hosted row was written, so no printed fact was created for a label whose
  outcome is unknown.

### What failed

- **Two of two `Print all` runs stopped on the batch's own first label.**
- Across the whole campaign, **three of five physical print attempts ended in an
  uncertain outcome** (Operators 11, 01, 02). Every single-label print that was
  attempted after a resolved recovery succeeded (Operators 12, 01 retry).
- The gate requires one uninterrupted ten-label run. That has not occurred and,
  on this evidence, is not currently achievable.

### Root cause: not determined

Because each label is already an isolated print session, "batch" is not
structurally different from ten sequential single prints, so batching alone does
not explain the failures. The remaining candidate variables were **not** isolated
in this engagement and must not be presented as ruled out:

- printer firmware — deliberately unknown and deliberately not updated;
- ribbon and stock brand/lot — unknown;
- BLE interference or link quality in the test location;
- whether the 10 000 ms per-packet acknowledgement window is tight for this
  device, stock, and density (`kDensity = 3`);
- printer thermal or mechanical recovery time between back-to-back sessions.

Determining which of these applies requires instrumented repeat runs and is a
debugging engagement, not a validation pass.

### Single-label printing confirmed working after the batch failure

At 15:56:49 CDT Colton connected the M2_H and used the yellow single-label
**Print this label** action. Fictional Operator 03
(`420a4a22-8ec7-4437-a43a-389a15db2d12`) printed cleanly and synchronized
immediately: the hosted row advanced to `label_printed: true` at revision
`2026-07-27T20:56:49.29934+00:00`. Nine unprinted rows remain on the batch day.

Single-label printing is now **three for three** across the campaign — Operator
12 offline, the Operator 01 recovery retry, and Operator 03 — against **zero for
two** for `Print all`. This is the evidence base for accepting single-label
printing as the supported operating mode.

The deck did not block on Operator 02's outstanding recovery record, and that is
correct rather than a defect. `deckBlock` returns `recoveryPending` only when
`pendingLabels.isEmpty && currentRecoveryRecords.isNotEmpty` — recovery blocks
the deck only once the queue's own top item is the one awaiting a physical
check. With nine other labels pending, printing legitimately continued.

### Outstanding: Fictional Operator 02 is still unresolved

As of 15:56 CDT the ledger still holds the `uncertain` record for Operator 02,
and its hosted row is still `label_printed: false` at the original seed
revision. A physical label for Operator 02 was reported as emerged but was never
inspected and never resolved through either recovery action.

This is a live loose end, and it is the exact shape of the error that spoiled
Operator 11: an uncertain record resolved without physical inspection. It must
be closed by inspecting the paper and choosing **Label printed — sync only** if
a usable Operator 02 label exists, or **Nothing printed — retry** if it does
not. Until then, Operator 02 must not be counted as printed and must not be
counted as unprinted.

Read-only confirmation at 17:31 CDT on 2026-07-27: the paired iPhone still
reports the isolated bundle at `1.0.0 (9)`, and its preferences contain exactly
one `ctc_print_recovery_v1` row for Operator 02 order
`1456b740-8cbf-4c64-b70f-6abac7349ec7`, state `uncertain`, created
`2026-07-27T20:44:48.427775Z`. No app was launched and no recovery choice was
made. The production bundle is installed at `1.0.0 (10)`, which is installation
evidence only and not a physical Build 10 pass.

### Owner decision

On 2026-07-27 the owner chose to record Gate 3 as failed with this diagnosis,
continue validating the remaining gates, and hand off with **single-label
printing as the supported operating mode**. Unattended batch printing is a
documented product limitation, not a claimed capability. No shipping code,
`niim_blue_flutter` pin, printer firmware, geometry, or density was changed.

## Historical pre-upload physical-session plan

The phases below preserve the Build 9/disposable and direct-install plan used
before the production-configured TestFlight upload. Do not follow them as the
current Build 10 acceptance route. Use the exact TestFlight build and the
numbered current worksheet in
`docs/build-10-pilot-handoff-2026-07-27.md`.

The historical plan was to complete the phases in order and keep the cold-cup
timer running while the batch, recovery, and isolation checks executed.

The preserved Build 9 IPA is production-configured and must not be used for
fictional acceptance writes. Before Phase A, use a detached temporary worktree
at exact Build 9 source `47c4405` and run it on the iPhone in release mode with
only the disposable project's public URL and publishable key. Do not archive,
export an IPA, upload, edit source, or use a production account. Confirm that a
disposable user can see only the fictional disposable fixture; stop immediately
if any real day or person appears. Record the detached commit, redacted command,
install time, and displayed `1.0.0 (9)`. Preserve that safe Build 9 device
install until every Build 9 row passes.

### Phase A — record hardware and clear Build 9

1. Record tester, iPhone, Build 9, exact M2_H model/asset, firmware without
   updating it, ribbon, stock/lot, measured dimensions, shape/feed, and density.
2. Force-quit every official NIIMBOT app nearby and power off other NIIMBOT
   printers.
3. With Account A online, sign in, select the fictional Active day, wait for a
   clean sync, force-quit Capture This, and relaunch. Record restoration of the
   same account, day, board, and no unexpected recovery.
4. Force-quit again, enable airplane mode, and relaunch. Record authenticated
   cache restoration, visible offline/staleness state, the same day/board, and
   a usable local print queue.
5. Still offline, print one reserved label. This physical success must become
   printed-but-unsynced. Relaunch once, restore connectivity, choose **Label
   printed — sync only**, and verify the hosted row becomes printed without a
   second physical label.
6. With Reduce Motion off, print one representative label and have the tester
   record the success haptic and stamp timing. Apply that label to a cold cup
   and start a five-minute timer.
7. Print ten distinct labels as one uninterrupted M2_H batch. Number each
   physical label in the evidence notes and match it to its fictional order.
   Record orientation, crop, alignment, density, readability, feed gaps,
   skipped stock, ribbon behavior, and hosted printed state for all ten.
8. Start a second print and interrupt Bluetooth. Do not guess the outcome.
   Record the uncertain double-beat haptic without looking, force-quit and
   relaunch, inspect the printer/stock, and leave the unresolved item present
   for the isolation check.
9. Sign out. Sign in with Account B and verify Account A's selected-day pointer,
   cached board, pending mutation overlay, and recovery detail are not restored
   into Account B's scope. Account B may legitimately see shared server days
   while online; that is not a cache leak.
10. Sign back into Account A. Verify the exact unresolved recovery returns only
    here. Choose **Label printed — sync only** if paper exists or **Nothing
    printed — retry** if it does not, then verify the resolution causes no
    accidental duplicate.
11. Turn on iOS Reduce Motion. Repeat one preview/print transition and record
    that motion is removed or shortened while the physical success feedback
    remains understandable.
12. Select the Planning day and then the Complete day. Attempting to print must
    be visibly refused before any physical packet or label.
13. After at least five minutes, inspect the cold-cup label for lift, smear,
    fade, contrast, and readability and photograph fictional evidence only.
14. Exercise the disposable **Advanced · Legacy link** and `/labels` fallback.
15. Power-cycle/reconnect once and background/resume once, printing one
    additional fictional label after each recovery if the physical gate record
    does not already contain those observations.

### Phase B — independent Build 9 operator pass

the intended operator performs sign in → select Active day → connect M2_H → print → hosted sync
→ airplane-mode authenticated restore → interrupted-print inspection and
recovery → Legacy fallback. Colton does not touch the phone, printer controls,
or dashboard from the first sign-in until the intended operator declares the run complete.
Record any spoken prompt or rescue as assistance; the check remains open if
builder intervention was required.

Only after Phases A and B pass may Build 9 be replaced on the phone.

### Phase C — superseded direct-install plan

This was the pre-upload plan. The owner later authorized a clean,
production-configured archive and upload, and Build 10 is now internally
available through TestFlight. Current Build 10 acceptance must use that exact
TestFlight `1.0.0 (10)` and a fictional account plus Active day in the
production backend. Do not substitute the separate disposable Supabase project:
the uploaded IPA does not contain its host.

Record the exact command with credentials redacted, source commit, install
timestamp, phone model/iOS, and app version. If the source changes, stop,
review the diff, and rerun Flutter plus frozen-web regressions before continuing.

### Phase D — Build 10 seven-step acceptance

For the current exact TestFlight Build 10, perform this scenario with the
owner-approved fictional invited account and Active day in the production
backend. The uploaded IPA cannot use the separate disposable project. Never
place production credentials or identifiers into this record.

1. Account A loads the existing fictional Active day online. Capture a
   server-side T0 snapshot of every target order's ordinary fields,
   `label_printed`, and `updated_at`.
2. Enable airplane mode, force-quit, and cold-start from the authenticated
   cache. Record the account, day, roster, staleness state, and pending count.
3. Capture at least three different orders and physically print at least two
   labels on the accepted M2_H/stock. Record the intended ordinary fields and
   map each physical label to its order ID.
4. With mutations still pending, kill the app and relaunch offline. Record that
   all three optimistic orders, both printed facts, and pending counts return.
5. Restore connectivity and wait for one completed synchronization.
6. Capture T1 directly from Supabase. Every intended ordinary field and both
   printed facts must be present. Trigger a second manual refresh/sync without
   editing, then capture T2. T2 values and `updated_at` values must equal T1;
   no new physical label may emerge. Because every order `UPDATE` advances
   `updated_at`, any unexplained T2 revision advance is a failed
   no-second-replay check even when the visible values appear identical.
7. For another order, let the phone retain revision R0 and stage a local
   ordinary edit offline. From Account B/web, make a competing ordinary edit
   that advances the server to R1. Reconnect the phone. The app must show a
   visible durable conflict with local and server versions, make no overwrite,
   and require **Use phone version** or **Keep server**. Read the server row to
   prove R1 remains unchanged before explicit resolution.

Per-order evidence:

| Fictional order | T0 revision | Intended phone fields | Physical label? | T1 fields / printed / revision | T2 identical to T1? |
|---|---|---|---|---|---|
| Order 1 | _____ | _____ | yes/no _____ | _____ | _____ |
| Order 2 | _____ | _____ | yes/no _____ | _____ | _____ |
| Order 3 | _____ | _____ | yes/no _____ | _____ | _____ |

Conflict evidence:

- Order / R0: _____
- Local intent: _____
- Competing server value / R1: _____
- Visible conflict screenshot/log: _____
- Server unchanged before operator choice: pass/fail _____
- Explicit resolution and final row: _____

### Phase E — refresh fallbacks and inactive-day replay refusal

Steps 1–5 below preserve the original disposable-project fault-injection plan.
Do not remove or add production publication membership merely to make a
physical test. On the current production-configured TestFlight build, make one
safe fictional update, observe whether Realtime refreshes the phone, and
otherwise record polling, resume, pull-to-refresh, or manual sync as the
fallback actually observed. Production publication membership remains a
separate read-only database query.

The original fault-injection procedure was for the disposable project only:

1. While `public.orders` is published, make a fictional Account B update and
   record that the phone refreshes authoritative board data after the filtered
   Realtime signal. Source and automated tests establish that the payload is
   discarded and followed by a fetch.
2. Temporarily remove `public.orders` from the disposable project's
   `supabase_realtime` publication. In a `finally`/cleanup path, always add it
   back.
3. Make one server edit, use manual pull-to-refresh/sync, and verify the phone
   fetches it.
4. Make a second server edit without touching the phone and verify the
   ten-second polling path fetches it. Record the observed interval.
5. Re-add `public.orders` to the publication and verify membership before
   continuing.
6. Stage a fictional pending order edit, change that day to Planning on the
   server, reconnect, and verify the pending intent remains but neither replay
   nor printing occurs. Repeat for Complete. Restore Active only if needed for
   explicit resolution and cleanup.
7. Recheck **Advanced · Legacy link** after Build 10 installation.

Results:

- Realtime signal followed by authoritative refresh: pass/fail _____
- Manual refresh with Realtime absent: pass/fail _____
- Polling with Realtime absent / observed delay: pass/fail _____ / _____
- Publication restored and filtered signal reverified: pass/fail _____
- Planning pending retention / replay refusal / print refusal: _____
- Complete pending retention / replay refusal / print refusal: _____
- Legacy fallback: pass/fail _____

## Failure and evidence rules

- Timestamp every observation in CDT and identify the tester.
- Use screenshots, photos, and sanitized query output only when they contain
  fictional data and no credential, token, email password, or project secret.
- A print is successful only when the physical label is usable and mapped to
  the intended fictional order.
- If paper may have emerged, stop and inspect before choosing a recovery action.
- Do not retry an uncertain label merely to make the test green.
- A conflict passes only if the competing server value survives until an
  explicit operator choice.
- Any printer library, firmware, geometry, density, or label-layout change
  invalidates the affected physical evidence and requires source review plus
  regression reruns.
- Preserve `niim_blue_flutter: 1.0.1`, the observed firmware, M2_H-only
  validation, 591×354 `grid-01`, direct signed-in Supabase access, and Legacy
  fallback.

## Release decision

Build 10 is available through internal TestFlight, but physical release,
printer mailing, and the buddy pilot remain on hold until:

- all ten Build 9 rows are observed and recorded, each either passed or — as
  with row 3 — explicitly failed, diagnosed, and accepted by the owner as a
  stated product limitation. A row may never be left merely unobserved, and a
  failed row may never be softened into a pass;
- the production Realtime publication membership query is recorded; the
  production monotonic printed-fact trigger is already verified enabled, and
  the disposable project separately passed both migrations;
- the Build 10 seven-step scenario, refresh fallbacks, and inactive-day guards
  pass on the physical phone/printer/stock;
- fictional fixtures, accounts, and links have named cleanup owners and remain
  available through Apple review and the buddy pilot; clean them only after
  neither still needs them;
- regressions are rerun after any code change;
- the owner explicitly authorizes any later archive, push, or TestFlight
  upload. The Build 10 archive/upload was authorized and completed on
  2026-07-27.

External Beta App Review is separately blocked on the owner-approved Build 10
metadata/contact fields and the production fictional fixture. It does not
require another binary unless Build 10 is Internal Only, Apple requires a
binary change, or an approved release-blocking fix is necessary.

Final gate decision / tester / timestamp: _____
