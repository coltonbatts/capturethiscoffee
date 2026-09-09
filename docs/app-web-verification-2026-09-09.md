# App and website verification — September 9, 2026

Result: current web source is deployed; shared people/order implementation is
present. A live app-to-web and web-to-app round trip is **not yet verified**.

## Deployment and UI

- Vercel resolved `coffee.capturethis.com` to production deployment
  `dpl_3BzknQSDRztn4nyWWtTybBVLU1hn`, READY, commit
  `4685066c49ba72a0db639a452fb147c7d10fc8e7` (PR #35).
- Local HEAD `ff10854` has no `src/` differences from that deployed commit.
  Subsequent differences are native release identity, two About screenshots,
  and Build 14 release documentation.
- The live authenticated homepage, People directory, Add person form, Days,
  and fictional active-day order board loaded. The board exposes Take order,
  Edit order, and New guest. No production records were changed by this check.
- The September 8 Build 14 ledger records upload and internal TestFlight
  assignment. This check did not independently inspect current Apple state or
  establish installation on either tester's phone.
- The running simulator displays the fixtures from
  `mobile/tool/simulator_review.dart`, whose dependencies are memory repositories.
  Its UI is useful for visual review, not production synchronization evidence.
- Native UI polish does not establish identical web layouts; the website retains
  its supported web workflows and shared visual system.

## Shared data behavior found in source

- Native and authenticated web people creation call `setup_create_person`.
  Both use authenticated Supabase access. Native configuration must point to the
  same production project as the website.
- Both order clients operate on shared `orders` and roster/person records.
  The web production board and native workspace refresh every ten seconds, with
  order Realtime events providing an additional refresh signal.
- Native offline order edits use durable outbox replay and revision conflicts;
  offline changes cannot appear on the website before successful synchronization.
- Standalone People directories do **not** automatically refresh for remote
  changes: the native screen loads on entry and has Refresh people; the web
  directory needs a page refresh/reload to fetch changes made elsewhere.
  This differs from the automatically refreshed active order boards.

## Checks run

- `npm test`: 116 passed, zero failures (27 suites).
- `flutter test --no-pub test/authenticated_flow_test.dart
  test/setup_controller_test.dart test/setup_navigation_test.dart
  test/order_mutation_outbox_test.dart test/app_store_screenshot_test.dart`:
  37 passed, including existing UI golden comparisons; no baseline updates.
- No implementation, renderer, printer, dependency, or release changes made.

## Remaining acceptance

Use Build 14 signed into the same production account/workspace as the website.
Create a uniquely named fictional person and capture an order on one client;
verify the exact record and drink on the other, then reverse direction. Check
automatic board refresh, explicit People refresh, and one offline native edit
followed by successful replay. Do not print or change existing client records.
Record installed build identity and actual results before declaring full parity.
