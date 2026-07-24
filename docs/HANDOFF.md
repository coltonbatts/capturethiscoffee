# Capture This handoff hub

Last updated: 2026-07-24

Start here whenever Capture This changes hands. This page is the index and
definition of done; the linked documents contain the detailed procedures and
evidence.

## Product in one sentence

Capture This is a shoot-day coffee operations system that collects crew drink
orders, turns them into correctly labeled cups, and keeps the production board
in sync.

The hosted website is the source of truth for productions, rosters, orders, and
printed status. The Capture This iPhone app is the on-set controller that loads
one production's captured orders, prints them to the accepted NIIMBOT M2_H, and
synchronizes each successful label.

## Current release position

- TestFlight build 5 is the existing pilot build, per the account owner.
- Source version `1.0.0+6` is the next handoff candidate. It adds offline
  in-app operating instructions and blocks new physical prints until the linked
  production is Active.
- Build 6 has a signed, inspected App Store IPA. It still needs a TestFlight
  upload and the physical acceptance run before it replaces build 5.
- TestFlight is temporary. The durable distribution target is an
  Apple-approved unlisted App Store link.
- The handoff is not complete until the named day-of operator passes the
  physical workflow independently and the ownership register is filled.

## Read this by role

| Person | Start here | Purpose |
|---|---|---|
| Day-of label operator | [Luke Quick Start](luke-quick-start.md) | Link, connect, print, and recover safely |
| Coordinator / runner | [Standard operating procedure](standard-operating-procedure.md) | Prepare the production, collect drinks, coordinate printing, and close out |
| Hardware acceptance tester | [Physical release test](physical-release-test.md) | Verify the exact phone, M2_H, firmware, ribbon, stock, batch behavior, sync, and cold-cup result |
| Platform / business owner | [Operational handoff](operational-handoff.md) | Assign ownership for accounts, billing, backups, support, distribution, stock, and replacement builds |
| Apple release operator | [TestFlight checklist](testflight-checklist.md) and [App Store dossier](app-store-release.md) | Build, upload, pilot, submit, and maintain the permanent distribution path |
| Engineer | [Mobile README](../mobile/README.md) and [release evidence](release-evidence-1.0.0.md) | Reproduce, verify, diagnose, and document a release |

Historical strategy documents are not operating instructions. In particular,
`Luke_CTC_Overview.md` predates the working direct-M2_H app and must not be used
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
- A private share URL for one Active production.
- A signed-in web operator who can prepare the roster, activate the production,
  issue/reissue links, and use `/labels` as fallback.
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

1. A signed-in operator confirms the roster and marks the production Active.
2. The runner uses the private production link to collect or update drinks.
3. The label operator opens Capture This and links the same private URL.
4. The operator force-quits the official NIIMBOT app, powers off other NIIMBOT
   printers, and connects the accepted M2_H.
5. The operator refreshes, reviews the person and drink, prints, and waits for
   synchronization before moving on.
6. For an interrupted print, the operator inspects the physical output before
   choosing sync-only or retry. The operator never guesses.
7. If Capture This is unavailable, a signed-in operator uses `/labels` for the
   documented PNG/CSV fallback.
8. After the run, the owner records issues, powers down the printer, and revokes
   disposable links when they are no longer needed.

The same condensed sequence is available inside build 6 from the help icon, so
the operator can read it without repository access.

## Failure decision table

| What happened | Correct action |
|---|---|
| No physical label came out | Choose **Nothing printed — retry** after reconnecting |
| A usable label came out but web sync failed | Choose **Sync only**; do not print again |
| Bluetooth stopped and the physical outcome is unclear | Inspect the printer and stock before choosing; stop and escalate if still uncertain |
| More than one NIIMBOT appears | Power off every printer except the accepted M2_H |
| Production says Planning | Ask the coordinator to mark it Active, then refresh |
| Queue is empty unexpectedly | Confirm people are on set and their orders are captured rather than waiting/no-drink |
| App cannot be restored in time | Use the authenticated `/labels` fallback and record printed state with the coordinator |

## Handoff session

The receiving operator must complete this without the outgoing operator touching
the phone or dashboard:

1. Install/open the named build.
2. Link a disposable fictional Active production.
3. Connect the exact accepted M2_H.
4. Print short, long, intentional-reprint, and 10+ batch cases.
5. Confirm every physical success appears printed on the hosted board.
6. Recover one interrupted/uncertain print without a duplicate.
7. Power-cycle/reconnect and background/resume.
8. Complete one `/labels` fallback print.
9. Explain the failure decision table back to the owner.
10. Sign the physical and operational acceptance records.

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
