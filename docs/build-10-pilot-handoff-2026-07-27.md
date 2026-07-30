# Build 10 pilot, printer, and operator handoff

Last updated: 2026-07-27 18:49 CDT

Build 10 is the current controlled-pilot candidate. It is internally available
through TestFlight, but it is not externally approved, physically accepted, or
ready to leave the product builder's possession.

## Current release status

| Classification | Current evidence or requirement |
|---|---|
| Verified | Documentation-session starting point: clean `main`, `HEAD`, and fetched `origin/main` at `45d5aaa`; mobile `1.0.0+10`; bundle `com.capturethis.ctcprinter`; app source `fea2fc3`; clean archive source `ab5edb8`; uploaded IPA SHA-256 `7a578953a32c5437f082392141b06559bce81eaab7252657ee9aa2366e9e30b7`; internal availability reported at 16:26 CDT on 2026-07-27 |
| Verified | Privacy and support URLs each returned HTTP 200 at 17:22 CDT on 2026-07-27 and visibly identified Capture This plus `info@capturethis.com`; owner approval of their wording is still open |
| Verified | `ITSAppUsesNonExemptEncryption = false`; final export-compliance attestation remains the account owner's decision |
| Physically passed | Build 9 baseline checks 1, 2, 5, 6, and 9: online restoration, authenticated airplane-mode cold start, printed-but-unsynced sync-only recovery, two-account cache isolation, and cold-cup adhesion/readability |
| Failed with accepted limitation | Build 9 Gate 3 failed twice on the first batch label because printer acknowledgements timed out. It is not a pass. Single-label printing is the supported mode; Print all and unattended batch printing are unsupported |
| Still open | Build 9 checks 4, 7, 8, and 10; the complete Build 10 physical acceptance; exact TestFlight expiration; production Realtime publication membership; representative sanitized photos; hardware/consumable details; external review and buddy pilot |
| Still open — print safety | Read-only phone-container audit at 17:31 CDT confirmed Fictional Operator 02 still has exactly one durable `uncertain` record after paper emerged. Its paper must be physically inspected before any recovery choice. Never resolve it from database or app state alone |
| Blocked on owner input or approval | Exact external-TestFlight copy was approved at 18:42 CDT on 2026-07-27; review contact is the private review contact and the review phone/email were supplied privately. The owner declined `info@capturethis.com` for tester feedback. Still open: replacement feedback email; buddy identity/email; privacy/support wording approval; secure production fixture owner/cleanup; production fixture creation; explicit Beta App Review submission approval; temporary credential rotation; dependency-risk decision; ownership/backup register |
| Blocked on Apple | Beta App Review decision and external availability after an approved submission |
| Post-pilot | Builds 11–13 product-independence work, complete App Store metadata, unlisted App Store approval, permanent-link clean install, two-person replacement-build capability, backup/restore program, and release tag |

## Decision snapshot

| Question | Current answer |
|---|---|
| May Build 10 be submitted for external TestFlight now? | **No.** The exact metadata copy is approved, but the contact fields, separate owner attestations, secure fictional production fixture, and explicit submission approval remain open |
| May the buddy install now? | **No.** Build 10 is not approved for external testing and the buddy must not be invited before Apple approves it |
| May the printer be mailed now? | **No.** Build 10 has no recorded physical device session, Operator 02 remains unresolved, and the inventory/firmware/consumable/packing record is incomplete |
| Is Capture This fully released or operationally independent? | **No.** A controlled pilot can use existing Active days, owner-provisioned accounts, website setup, single-label printing, documented fallback, and named support; permanent independence remains later work |

## Read-only verification recorded this session

- At 17:22 CDT, `/privacy` returned HTTP 200, `text/html`, 24,363 bytes.
- At 17:22 CDT, `/support` returned HTTP 200, `text/html`, 20,749 bytes.
- `npm audit --omit=dev` exited 1 with **three high-severity findings**:
  Next 16.2.11 bundles PostCSS 8.4.31 and Sharp 0.34.5 on the reported paths.
  Top-level Sharp is 0.35.3. The suggested `--force` action would install
  Next 9.3.3, a breaking downgrade, so no dependency was changed.

The dependency gate requires an upstream-compatible fix or an explicit,
documented risk decision. Do not run `npm audit fix --force` blindly.

- At 17:31 CDT, the paired iPhone 16 reported the isolated validation bundle at
  `1.0.0 (9)` and `com.capturethis.ctcprinter` at `1.0.0 (10)`. This proves
  installation only; it is not a visible app-open or physical-acceptance pass.
- The isolated Build 9 preferences still contain exactly one
  `ctc_print_recovery_v1` record: Fictional Operator 02 order
  `1456b740-8cbf-4c64-b70f-6abac7349ec7`, state `uncertain`, created
  `2026-07-27T20:44:48.427775Z`. No recovery choice was made.
- A read-only App Store Connect attempt reached Apple's sign-in screen because
  no connected authenticated session was available. Internal Only status and
  the authoritative Build 10 expiration therefore remain unverified; no App
  Store field was changed.

## Build 10 local physical acceptance worksheet

Use the exact TestFlight Build 10, the accepted `M2_H-I409130491`, current
50×30 mm rectangular holographic stock, and density 3. Force-quit the official
NIIMBOT app, power off other nearby NIIMBOT printers, and do not update
firmware. Record direct observations only.

| # | Required observation | Result / timestamp / evidence |
|---|---|---|
| 1 | Install/open from TestFlight and visibly confirm `1.0.0 (10)` | _____ |
| 2 | Sign into the individual fictional invited account | _____ |
| 3 | Load the existing fictional Active day online | _____ |
| 4 | Force-quit; confirm account, selected day, and board restore | _____ |
| 5 | Enable Airplane Mode while leaving Bluetooth usable | _____ |
| 6 | Force-quit; cold-start from the authenticated cache | _____ |
| 7 | Capture at least three different fictional orders offline | _____ |
| 8 | Print at least two labels individually; never use Print all | _____ |
| 9 | Inspect names, drinks, alignment, density, readability, and paper output | _____ |
| 10 | Force-quit with ordinary mutations and printed facts still pending | _____ |
| 11 | Relaunch offline; confirm every pending field and fact restores | _____ |
| 12 | Restore connectivity | _____ |
| 13 | Verify every field and printed fact reaches Supabase exactly once | _____ |
| 14 | Refresh/sync again; verify no revision changes or second replay | _____ |
| 15 | Create a safe competing edit; observe a durable visible conflict and no overwrite | _____ |
| 16 | Exercise **Use phone version** and **Keep server** on separate safe rows | _____ |
| 17 | Verify Planning and Complete retain pending work but refuse replay and printing | _____ |
| 18 | Distinguish success and uncertain haptics while holding the phone | _____ |
| 19 | Inspect physical-iPhone Reduce Motion behavior | _____ |
| 20 | Deliberately interrupt one single-label print, inspect paper, and recover without a duplicate | _____ |
| 21 | Power-cycle and reconnect the printer | _____ |
| 22 | Background and resume the app | _____ |
| 23 | Verify Advanced · Legacy link and authenticated `/labels` fallback | _____ |
| 24 | Observe production Realtime refresh or record polling/manual refresh as fallback | _____ |
| 25 | Record sanitized fictional-data evidence only | _____ |

Physical print rules:

- Uncertainty must be durable before the first printer packet.
- Usable paper emerged but sync failed → **Label printed — sync only**.
- Nothing emerged → **Nothing printed — retry**, but only after inspection.
- If the physical result is uncertain, stop and inspect before choosing.
- Never reset a server `label_printed: true` fact or reuse a printed fixture
  row.
- Never infer success from an app message, screenshot, source, test, PNG, or
  database state alone.

## Hardware inventory before mailing

| Item | Required record | Current value |
|---|---|---|
| Printer | Model and asset ID | NIIMBOT M2_H / `M2_H-I409130491` |
| Firmware | Version read without updating | _____ |
| Installed ribbon | Type, color, brand, lot, condition | _____ |
| Spare ribbon | Part, quantity, condition | _____ |
| Ribbon reorder | Supplier, exact listing/SKU, purchaser | _____ |
| Installed stock | Brand, type, finish, lot | Rectangular holographic; brand/lot _____ |
| Stock dimensions | Measured width × height | Reported 50×30 mm; measured _____ |
| Stock feed | Shape and die-cut/continuous | Rectangle / _____ |
| Spare stock | Exact quantity/roll count | _____ |
| Stock reorder | Supplier, exact listing/SKU, purchaser | _____ |
| Power | Charger and cable included/condition | _____ |
| Accepted app | Version/build and installation path | `1.0.0 (10)` / external TestFlight after approval |
| TestFlight | Authoritative expiration and renewal owner | _____ / _____ |
| Quick start | Revision supplied | `operator-quick-start.md`, revision _____ |
| Fallback | `/labels` account and drill passed | _____ |
| Limitation | One-label-at-a-time understood | _____ |
| Support | Contact, hours, term, response target, boundary | _____ |
| Evidence | Representative fictional short/long/cold-cup photos | _____ |
| Packing | Printer protected, stock secured, kit accepted for shipment | _____ |
| Shipping | Carrier/tracking/recipient confirmation | _____ |
| Release decision | **Printer may leave the product builder's possession: yes/no** | **NO — OPEN** |

Do not change the last field to yes until the local Build 10 session is complete
enough to show that the exact TestFlight build, printer, ribbon, and stock work
together safely.

## Buddy pilot worksheet after delivery

The product builder must not operate the buddy's phone, printer controls, or dashboard during
this pass. Assistance must be recorded and may leave the independent gate open.

An in-house independent Build 10 run is planned with a locally available tester.
If the product builder does not operate that tester's phone,
printer controls, or dashboard, that run may close the independent-operator
physical gate. It does not replace the post-shipping buddy acceptance unless
the owner explicitly designates her as the external pilot. Her name, iPhone,
iOS, invitation email, and TestFlight expiration remain to be recorded.

| Observation | Result |
|---|---|
| Invitation accepted after external approval; Build 10 installed | _____ |
| Tester, date, iPhone model, iOS, `1.0.0 (10)`, exact expiration | _____ |
| Individual invited account sign-in and fictional Active day selection | _____ |
| Exact shipped `M2_H-I409130491` connected | _____ |
| Short and long labels printed one at a time and physically usable | _____ |
| Fictional order collected/edited | _____ |
| Successful physical prints synchronized exactly once | _____ |
| One interrupted/uncertain print inspected and recovered without duplicate | _____ |
| Printer power-cycle/reconnect | _____ |
| App background/resume | _____ |
| Advanced · Legacy link and authenticated `/labels` fallback | _____ |
| Operator explains retry versus sync-only decision | _____ |
| TestFlight feedback/crash report path understood | _____ |
| Release blocker | none / _____ |
| Buddy acceptance — name/date/sign-off | _____ |

## Controlled pilot versus full independence

### Controlled buddy pilot may proceed after its gates

- Build 10 external approval and individual email invitation.
- Owner-provisioned account and an existing Active day.
- Website-based day, people, roster, link, and fallback setup.
- Sequential single-label printing only.
- Documented print recovery, `/labels` fallback, and named support.
- Fixture retained through Apple review and buddy acceptance.

### Full operational independence remains later work

1. Build 11: day creation/editing/activation plus people and roster management.
2. Build 12: summary/share workflow, fallback-link creation, and closeout
   guards.
3. Build 13: current full-app metadata, completed external pilot, unlisted App
   Store approval, and clean-device reinstall from the permanent link.
4. Verify production `public.orders` Realtime publication membership.
5. Rotate the temporary Supabase/Auth credential named in release evidence.
6. Resolve or explicitly accept the production dependency audit.
7. Assign primary and backup owners for Apple, Supabase, Vercel, GitHub,
   domain, billing, support, TestFlight renewal, backups, and releases.
8. Record Supabase backup/PITR capability, retention, restore-drill owner, and
   latest successful drill.
9. Prove a second person can sign and upload a replacement iOS build.
10. Create `capture-this-v1.0.0` only after the physical and external pilot
    gates pass.
11. Remove fixtures, accounts, and links only after Apple and the buddy no
    longer need them.

## Next controlled actions

1. Obtain owner approval and the missing private values listed in
   [`build-10-external-testflight-metadata-2026-07-27.md`](build-10-external-testflight-metadata-2026-07-27.md).
2. Create the fictional production account/day only after explicit production
   write approval.
3. Submit Build 10 for Beta App Review only after explicit submission approval.
4. In parallel with Apple review, complete the local Build 10 physical
   worksheet one operator action at a time.
5. Mail only after the hardware inventory and local Build 10 mailing gate are
   signed.
6. Invite the buddy only after Apple approves Build 10 for external testing.
