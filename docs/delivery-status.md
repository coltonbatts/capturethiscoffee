# Delivery status

Assessed **2026-09-08**. This is the single current delivery checklist; update it
as gates close. Flutter `mobile/` is the product. The goal is an independently
operable iPhone app installed through the App Store. **Release readiness is not
yet established.** Existing features are sufficient for an acceptance candidate;
a rewrite or new feature program is not needed.

## Implemented and verified locally

Baseline: local `main` at `3ae2eb06decb003693253cc09c3774545feee70f` **plus the
uncommitted printer hardening**. Source still declares `1.0.0+13`; this working
tree is not the previously uploaded Build 13 binary.

- [x] Native sign-in, Days, online people/roster setup, offline capture and
  per-user cached boards, revision-conflict handling, single-label printing,
  durable recovery, template preview, summary/share, and guarded closeout are
  implemented. `authenticated_flow_test.dart`, setup, cache, outbox, recovery,
  offline, and widget suites pass. These use fakes/fictional fixtures, not live
  Supabase or a real operator.
- [x] Reviewed the three modified Dart files, new `printer_transport.dart`, and
  three new regression files against HEAD. Keep this hardening together: failed
  persistence aborts transmission; ledger writes serialize; corrupt recovery
  fails closed; timeout/disconnect invalidates later transport phases; stale
  workspace sync is rejected; confirmed-print recovery never retransmits.
  Retain the work for candidate review; no source edits or commits were made
  during this takeover. Details: [September 7 trace](native-print-hardening-2026-09-07.md).
- [x] Exact `niim_blue_flutter: 1.0.1` and lockfile retained. Adapter tests assert
  one page/quantity one, density 3 and gap stock. Preview still uses
  `renderLabelImage`, and printing its PNG wrapper. Renderer and golden files
  have no working-tree diff.
- [x] Access architecture remains unchanged: native public-key/session RLS,
  request-scoped authenticated web DAL, and token-scoped public fallback.
  Auth/boundary/DTO tests pass; this is not a current production RLS audit.

| Check run September 8 | Result |
| --- | --- |
| `flutter analyze --no-pub` | Pass, no issues |
| `flutter test --no-pub` | Pass, **236 tests**, including existing physical-label and App Store screenshot goldens; no baseline updates |
| `flutter build ios --simulator --no-codesign --no-pub` | Pass; compile only, no device install, signing or live session verified |
| Dart format, `--output=none --set-exit-if-changed`, seven hardening files | Pass, zero changes |
| `npm run lint` / `npm test` | Pass / **115 tests**, 27 suites, zero failures |
| `npm run build` | Pass, Next.js 16.2.11 |
| `npm run verify:niimbot-export` | Pass, 591×354 PNG, 18 px margin, 567 px effective width |
| `npm audit --omit=dev` | **Non-passing:** four high package entries: nanoid, Next (transitive), PostCSS, Sharp |
| Documentation links and `git diff --check` | Pass |

Environment: macOS, Flutter 3.44.4 / Dart 3.12.2, Node 22.22.2; existing
usable dependencies reused. Local command logs are temporary evidence under
`/tmp/ctc-takeover-20260908/`; do not treat that directory as a durable release
artifact. No real client fixtures or credentials were copied into this checklist.

Other incoming changes—agent/contribution guidance, README revisions, the
instruction audit, subsystem guide, and untracked `output/` PDF—remain intact
and uncommitted. They are not printer implementation or a validated release
artifact. Review them separately before staging; do not bulk-add the tree.

## Core journey polish — September 8

- [x] Reviewed actual iPhone 17e / iOS 26.3 Simulator screens before editing:
  sign-in, Days, day setup, People, day overview, Collect, Print, recovery, and
  Summary. All data came from explicitly injected fictional memory repositories.
- [x] Compact lazy Collect rows, one expanded action area, visible printed status
  and conflict actions; direct Collect/Print/Summary navigation; setup opens
  Collect directly. Day overview prioritizes operation before preparation.
  Shared headers, sign-in copy, keyboard-safe People search, and adaptive
  large-text navigation/recovery layout retain cream/ink/yellow, Geist, and the
  supplied smiley. Known connectivity notices consolidate; unknown storage and
  printer errors remain visible. Print/Summary link directly to unresolved labels.
- [x] Final `flutter analyze --no-pub`: clean. `flutter test --no-pub`: **239 passed**,
  including existing offline/recovery/transport suites and physical-label goldens.
  Added 320×568 / 2× text / Reduced Motion route checks, keyboard checks, and
  unknown-error visibility coverage; updated navigation and collection tests.
- [x] Compared all **14 existing goldens before edits**. Inspected actual/expected/
  diff images, then updated only eight intentionally affected app UI baselines.
  About and all five label baselines remain unchanged. Sign-in capture now waits
  for image decoding; its former golden omitted the smiley. No renderer, preview,
  physical-label, dependency-pin, or incoming printer-hardening edits in this pass.
- [x] Simulator interaction checks: setup → Collect, expand/edit/save/cancel, direct
  Collect → Print navigation, keyboard presentation, and fictional offline sync-only
  recovery. iOS accessibility-extra-large screens inspected; recovery actions
  remain reachable by scrolling. Widget tests cover precise order values and
  setup → Collect → Print → Back behavior. These do not prove live Supabase,
  Bluetooth transmission, physical haptics, or independent operator acceptance.

Local visual evidence: [before/after gallery](../output/ui-polish/index.html),
with original simulator PNGs, additional large-text views, and retained golden
diagnostics in that directory. Check logs are copied there. These are working-tree
review artifacts, not App Store submission assets or release evidence. No signed
build, deployment, device install, Apple submission, or physical test was performed.

## Recorded historical release evidence

These are claims in dated records, **not fresh external verification**:

- [July 30 Build 13 ledger](release-evidence-1.0.0-build-13.md): source merged as
  `8dab20e`, migration applied, web deployment READY, signed IPA uploaded and
  processed, assigned to the internal Main group. Recorded local suite: 203
  Flutter tests. This predates the hardening above.
- [July 30 Apple evidence](build-13-app-store-connect-evidence-2026-07-30.md):
  Complete/Validated Build 13, saved metadata/screenshots, unpublished App Privacy
  draft. App Review was not submitted; copyright and Admin-published privacy
  blocked validation. Unlisted approval and manual release were pending.
- Build 12 was reported installed in its [July 29 record](build-12-native-setup-2026-07-29.md).
  Build 13 installation and its [physical worksheet](build-13-physical-acceptance-worksheet-2026-07-30.md)
  remain unproven in those records. Historical batch-print failures do not
  invalidate the supported deliberate single-label scope or authorize batch work.

## Externally verified current state

Read-only observations made September 8:

- GitHub `main` matches local HEAD. Its latest
  [main Quality run](https://github.com/coltonbatts/capturethiscoffee/actions/runs/30580507772)
  is successful; it does **not** contain the uncommitted hardening.
- The newest [Quality run](https://github.com/coltonbatts/capturethiscoffee/actions/runs/34118886557)
  is a failed run for dependency PR **#33**, not main: Web fails
  `long names fit without overlapping lines in every bundled renderer` with
  `caption lines cannot overlap` at `tests/label-template-schema.test.ts:93`.
  Mobile and Mobile screenshots passed; web build/export were skipped.
  PR #33 changes only `package-lock.json`. Locally the assertion passes.
  `fitLabelTemplateText` scales line height using floating-point arithmetic;
  host font metrics/rounding are a hypothesis, not an established root cause.
- Six dependency PRs (#28–33) are open; no open issues were returned. Existing
  PRs #28 and #30 overlap the audit remediation scope; inspect them before
  creating duplicate work. The current registry audit offers fixes, including
  Next 16.3.4; July's “only a breaking downgrade” statement is historical.
  Audit entries do not establish exploitability in this application.
- [Public site](https://coffee.capturethis.com/), [privacy](https://coffee.capturethis.com/privacy),
  [support](https://coffee.capturethis.com/support), and login returned HTTP 200.
  Anonymous `/productions` and `/labels` requests ended at login redirects.
  This verifies reachability and those redirects only, not the deployment SHA,
  authenticated functionality, database state, or support responsiveness.

## Unknown or blocked — essential work, in priority order

| Rank | Remaining scope / operator impact and release risk | Closure evidence |
| --- | --- | --- |
| **1** | **Finish the printer candidate.** Retain/review the hardening as one change, then test the exact signed candidate on the designated iPhone/M2_H/stock. Duplicate labels, unreadable output, or unusable recovery stop day-of work. | Reviewed commit and passing CI; exact build/kit recorded; interrupt init/data/finish, timeout/late completion, background/restart, power-cycle, offline capture, reconnect, and sync-only with **no retransmission**. Inspect actual paper, crop/feed/readability/adhesion and haptics. Use the existing physical worksheet procedure; keep Build 13 history intact and explicitly identify the replacement candidate. |
| **2** | **Resolve web CI and dependency risk.** Diagnose the caption assertion in the failing Linux environment and narrowly remediate/reassess production advisories using existing PRs. The supported fallback must remain reliable and safe. | Reproduce with measured font/line values; fix the cause without blindly relaxing tests or regenerating goldens. Matching CI web lint/tests/build/export pass; audit fixes or documented reachability/risk disposition. No printer dependency changes. |
| **3** | **Identify and validate the replacement release.** Hardening has no commit, unique uploaded build, current signing evidence, or physical acceptance. | Choose the next unused build after checking Apple, record source and artifact identity, run candidate checks and disposable full-schema/RLS/closeout verification, then archive/sign through the existing release procedure. Fresh authenticated Supabase/migration/deployment checks are still needed; HTTP health is insufficient. |
| **4** | **Complete Apple distribution.** Current App Store Connect state, legal/privacy attestations, review access, approval and permanent install link are unknown. Historical owner inputs are still open until checked. | Owner/Admin resolves copyright/privacy/contact/rights/agreements; validate fictional review credentials and candidate screenshots, ordinary App Review, intended unlisted approval, controlled release and direct-link clean-phone installation. Use the existing [review packet](build-13-app-review-unlisted-packet-2026-07-30.md), revalidated for the candidate. No submission or deployment performed here. |
| **5** | **Prove buddy independence.** Unassisted setup, collection, recovery and closeout, account recovery, replacement-phone install, consumables and backup support ownership are unverified. | Buddy completes a fictional day without engineering operating the phone: create/activate/roster, collect offline, print/recover/sync, resolve conflict, summary/closeout and fallback drill. Fill the existing [operational ownership/kit register](operational-handoff.md), including support, backups, renewals and replacement-build owner; update the [quick start](operator-quick-start.md) to the actually accepted build. Fix only observed usability blockers. |

Database integration was not rerun: no usable local Supabase CLI/disposable
instance was established (Docker daemon unavailable). No authenticated Apple,
production database, installation, radio, printer, or physical operator check
was performed. Storage acknowledgement and protocol completion are not proof
of power-loss durability or usable paper. The transport cannot retract bytes
already handed to the BLE plugin; physical interruption acceptance remains essential.

## Optional enhancements — defer until acceptance

Additional visual/motion polish, more templates, native template authoring,
expanded dashboards and new web-only features are not required to release the
existing workflow. Fix demonstrated readability/accessibility/navigation issues
from the operator drill; do not preempt it with a redesign. Batch printing,
printer firmware and dependency upgrades remain outside this release scope.

**Recommended next task:** review the UI pass with the preserved printer
hardening, run CI, and produce an identified signed acceptance candidate. Then
run the existing fictional-data iPhone/M2_H/stock acceptance procedure, with
the buddy operating the app independently. Resolve findings
before spending effort on extra product surfaces. Keep this checklist current
and attach exact-candidate evidence to the existing release procedures.
