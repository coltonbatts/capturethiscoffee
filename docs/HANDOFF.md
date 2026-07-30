# Capture This handoff hub

Last updated: 2026-07-30

Start here whenever Capture This changes hands. This page is the index and
definition of done; the linked documents contain the detailed procedures and
evidence.

Current Build 13 engineering, release, and blocker status:
[`build-13-app-store-launch-2026-07-30.md`](build-13-app-store-launch-2026-07-30.md).
Historical release evidence remains available in
[`current-state-2026-07-25.md`](current-state-2026-07-25.md) and the dated
Build 10–12 records.

## Product in one sentence

Capture This is a shoot-day coffee operations system that collects crew drink
orders, turns them into correctly labeled cups, and keeps the production board
in sync.

Supabase is the shared source of truth for productions, rosters, orders,
printed status, day completion, and published label-template versions.
Build 13 keeps Build 12's native day/people/roster setup, collects and edits
orders offline, previews the production's snapshotted template, prints captured
orders one at a time to the accepted NIIMBOT M2_H, durably replays changes,
stops on visible conflicts, summarizes the day, and performs a guarded,
server-authoritative closeout. The website remains the operator surface for
template drafting/publishing, selecting the default template, assigning a
published template to a Planning day, links, the zero-install runner, and
PNG/CSV fallback.

## Current release position

- Build 12 source was squash-merged to `main` as
  `88dcf1f346525cd7eed5dfb32be1499fe66855e1`. Its signed
  `1.0.0 (12)` artifact was uploaded, processed, assigned only to the existing
  internal `Main` group, and reported installed by its one existing tester.
  Full evidence is in
  [`build-12-native-setup-2026-07-29.md`](build-12-native-setup-2026-07-29.md).
- Build 13 is the operator-ready/unlisted-App-Store release candidate. It was
  squash-merged as `8dab20e9f737a0d83e3ed21dea2c0417b4b5546c`, its
  migration and exact production web deployment are live, and its
  distribution-signed `1.0.0 (13)` binary was uploaded at 13:02 CDT on
  2026-07-30. At 13:04 CDT Apple emailed that it is available to the existing
  internal tester. App Store Connect now records Build ID
  `79ca63c6-38b1-43d6-af1e-d0f4b2d44e47`, Complete/Validated processing,
  assignment only to the one-tester internal `Main` group, free U.S.-only
  availability, manual release, nine screenshots, a calculated 4+ rating, and
  an unpublished conservative App Privacy draft. App Review validation is
  blocked on owner copyright text and Admin-published App Privacy. It is not
  represented as installed, physically accepted, reviewed, approved for
  unlisted distribution, or released until direct evidence closes those gates.
- Build 9 Gate 3 failed twice. Unattended batch printing is not supported and
  must never be reported as a pass. The supported operating mode is one label
  at a time.
- Build 13's exact physical worksheet is
  [`build-13-physical-acceptance-worksheet-2026-07-30.md`](build-13-physical-acceptance-worksheet-2026-07-30.md).
  It remains incomplete until direct observations are recorded for the final
  phone, iOS, printer, firmware, ribbon, stock, and signed build.
- Build 13's metadata, review notes, questionnaire positions, screenshot plan,
  and unlisted sequence are in
  [`build-13-app-review-unlisted-packet-2026-07-30.md`](build-13-app-review-unlisted-packet-2026-07-30.md).
- The authenticated App Store and TestFlight record is in
  [`build-13-app-store-connect-evidence-2026-07-30.md`](build-13-app-store-connect-evidence-2026-07-30.md).
- TestFlight is temporary. The durable distribution target is an
  Apple-approved unlisted App Store link.
- The handoff is not complete until the named day-of operator passes the
  physical workflow independently and the ownership register is filled.

## Read this by role

| Person | Start here | Purpose |
|---|---|---|
| Day-of label operator | [Operator quick start](operator-quick-start.md) | Install, connect, print, and recover safely |
| Coordinator / runner | [Standard operating procedure](standard-operating-procedure.md) | Prepare the production, collect drinks, coordinate printing, and close out |
| Hardware acceptance tester | [Build 13 physical worksheet](build-13-physical-acceptance-worksheet-2026-07-30.md) | Verify the exact phone, M2_H, firmware, ribbon, stock, individual printing/recovery, template output, sync, and cold-cup result |
| Platform / business owner | [Operational handoff](operational-handoff.md) | Assign ownership for accounts, billing, backups, support, distribution, stock, and replacement builds |
| Apple release operator | [Build 13 App Review packet](build-13-app-review-unlisted-packet-2026-07-30.md), [installation/replacement guide](app-store-installation-and-replacement-builds.md), and [App Store dossier](app-store-release.md) | Upload, prepare review, preserve manual release, request unlisted distribution, and maintain replacement builds |
| Engineer | [Mobile README](../mobile/README.md) and [Build 13 release evidence](release-evidence-1.0.0-build-13.md) | Reproduce, verify, diagnose, and document a release |

Historical strategy documents are not operating instructions. In particular,
`historical-ctc-overview.md` predates the working direct-M2_H app and must not be used
to choose the current printer path.

## What must travel with the app

### Physical kit

- The accepted NIIMBOT M2_H with asset/serial record.
- Charger and cable.
- Installed ribbon plus a named spare/reorder source.
- Accepted label stock plus a named spare/reorder source.
- The recorded firmware version. Do not update firmware as troubleshooting.
- An iPhone that meets the accepted iOS record.

### Access and distribution

- Capture This installed from the named current TestFlight build or verified
  unlisted App Store link.
- An owner-provisioned Supabase operator account and an existing Planning or
  Active day.
- A private share URL only when the Legacy link or zero-install runner fallback
  is being exercised.
- A signed-in web operator who can prepare the roster, manage templates, assign
  a published template while the day is Planning, capture orders, activate the
  production, issue/reissue runner links, and use `/labels`.
- Named primary and backup owners for Apple, Vercel, Supabase, GitHub, domain,
  support, billing, and renewals.
- A named person who can build and upload the next iOS version without relying
  on shared credentials.

### Procedures and evidence

- This handoff hub and the one-page quick start available to the operator.
- A completed physical release record for the exact accepted build and kit.
- Release evidence naming the source commit, build, IPA, deployment, and
  remaining limitations.
- The support contact and escalation boundary.
- The expiry/renewal owner while TestFlight remains the install path.

## Standard day-of sequence

1. A signed-in web or native operator creates the day and confirms its people
   and roster while it is Planning. If a non-default published template is
   required, a web operator assigns it before activation. Activation snapshots
   the immutable published version for the day.
2. The label operator opens Capture This, signs in, and selects the existing
   day. The app uses the validated remote template or its last-known-good
   cached snapshot; legacy days without a template use bundled Grid 01.
3. The operator force-quits the official NIIMBOT app, powers off other NIIMBOT
   printers, and connects the accepted M2_H.
4. The operator refreshes, reviews the person and drink, and prints exactly one
   label. The operator physically inspects it and confirms its recovery/sync
   state before starting another label. The shipping UI has no batch action.
5. For an interrupted print, the operator inspects the physical output before
   choosing sync-only or retry. The operator never guesses.
6. From **Summary & closeout**, review grouped drink quantities and every
   person's Waiting, Captured waiting to print, Printed, or No drink state.
   Share the summary if needed. Complete the day only while online and only
   after the app and server confirm no unresolved conflicts, pending/uncertain
   print recovery, waiting orders, or captured-but-unprinted labels.
7. If Capture This is unavailable, a signed-in operator uses `/labels` for the
   documented PNG/CSV fallback.
8. Use **Advanced · Legacy link** only when testing the Build 8 fallback or when
   account access is unavailable.
9. After the run, the owner records issues, powers down the printer, and revokes
   disposable links when they are no longer needed.

The same condensed sequence is available inside Build 13 from the help icon, so
the operator can read it without repository access.

## Failure decision table

| What happened | Correct action |
|---|---|
| No physical label came out | Choose **Nothing printed — retry** after reconnecting |
| A usable label came out but hosted sync failed | Choose **Sync only**; do not print again |
| Bluetooth stopped and the physical outcome is unclear | Inspect the printer and stock before choosing; stop and escalate if still uncertain |
| More than one NIIMBOT appears | Power off every printer except the accepted M2_H |
| Production says Planning | Ask the coordinator to mark it Active, then refresh |
| Queue is empty unexpectedly | Confirm people are on set and their orders are captured rather than waiting/no-drink |
| Remote template is invalid or unavailable | Keep using the app's last-known-good cached template; legacy days fall back to bundled Grid 01. Do not publish or assign an unverified design |
| Closeout is blocked | Resolve the exact Waiting, captured-unprinted, pending sync, conflict, or uncertain-print item shown; refresh online and retry |
| App cannot be restored in time | Use the authenticated `/labels` fallback and record printed state with the coordinator |

## Handoff session

The receiving operator must complete this without the outgoing operator touching
the phone or dashboard:

1. Install/open the named build.
2. Sign in with an individual owner-provisioned fictional account and select a
   fictional Active day.
3. Connect the exact accepted M2_H.
4. Confirm the expected template, then print short and long labels
   sequentially, one at a time; confirm no batch action is present.
5. Confirm every physical success appears printed in Supabase and on the hosted board.
6. Recover one interrupted/uncertain print without a duplicate.
7. Power-cycle/reconnect and background/resume.
8. Open Summary, explain the grouped quantities and every per-person state,
   share a fictional summary, and prove the server rejects premature closeout.
9. Complete the fictional day after every closeout precondition is satisfied,
   then prove the completed day cannot be reopened.
10. Complete one Legacy-link and one `/labels` fallback drill.
11. Explain the failure decision table back to the owner.
12. Sign the physical and operational acceptance records.

## Definition of done

The app is handoff-ready only when all of these are true:

- [ ] The exact source version is committed and the signed build is recorded.
- [ ] Automated mobile and web checks pass.
- [ ] The production backend, privacy URL, and support URL are live.
- [ ] The physical release test passes on the final printer, firmware, ribbon,
      stock, iPhone, iOS, and app build.
- [ ] The day-of operator completes the workflow independently.
- [ ] Primary and backup owners are named for every platform and recurring
      obligation.
- [ ] Support contact, response boundary, inventory, reorder sources, backup
      policy, and replacement-build path are recorded.
- [ ] Disposable test links and unnecessary access are cleaned up.
- [ ] The permanent unlisted App Store path is complete, or the current
      TestFlight build, expiry, and renewal owner are explicitly recorded.

## Safe incident report

Send only:

- Date/time.
- iPhone model and iOS version.
- Capture This version/build.
- Printer asset/serial, firmware, ribbon, and stock.
- Last successful step and exact sanitized error text.
- Whether a physical label came out.
- A fictional-data photo when print quality is the problem.

Never send a production link/token, password, service key, signing asset, or
real client data.
