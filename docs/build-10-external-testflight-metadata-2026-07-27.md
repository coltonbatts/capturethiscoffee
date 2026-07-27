# Build 10 external TestFlight metadata packet

Last updated: 2026-07-27 18:46 CDT

Status: **COPY APPROVED — CONTACTS, SEPARATE OWNER ATTESTATIONS, SECURE REVIEW
FIXTURE, AND SUBMISSION APPROVAL REQUIRED.**

This is the current external-TestFlight packet for Capture This
`1.0.0 (10)`. It supersedes the historical Build 6 beta copy in
[`app-store-release.md`](app-store-release.md). Do not paste a password,
production share token, Supabase key, signing credential, or broadly reusable
public TestFlight link into this file, Review Notes, or tester-facing copy.

## App and build identity

| Field | Current value |
|---|---|
| App | Capture This |
| App Store Connect record | Capture This Printer |
| Version / build | `1.0.0 (10)` |
| Bundle ID | `com.capturethis.ctcprinter` |
| Application source | `fea2fc3e0f8cb4a8039eade6f2d8362fd681a943` |
| Clean archive source | `ab5edb8bc6d0bf582746b81e1815dd0574a83320` |
| External group | `Capture This crew pilot` |
| Privacy URL | `https://coffee.capturethis.com/privacy` |
| Support URL | `https://coffee.capturethis.com/support` |
| Proposed feedback email | `info@capturethis.com` — **OWNER APPROVAL REQUIRED** |

## Exact beta app description

> Capture This helps an invited coffee-crew operator collect drink orders for
> an existing Active day and print individual cup labels directly from an
> iPhone to a NIIMBOT M2_H over Bluetooth. Build 10 supports
> owner-provisioned sign-in, existing-day selection, offline order collection,
> durable synchronization, visible conflict handling, and print recovery.
> There is no public sign-up. Day, people, and roster setup remain on the
> Capture This website. Print labels one at a time; Print all and unattended
> batch printing are not supported.

## Exact What to Test

> 1. Accept the email invitation, install Capture This, and confirm version
>    `1.0.0 (10)`.
> 2. Sign in with the individual fictional account supplied privately and
>    select the existing fictional Active day.
> 3. Load the day online, force-quit, and confirm the signed-in account and
>    selected day restore. Then enable Airplane Mode while keeping Bluetooth
>    available, force-quit again, and confirm the cached day opens offline.
> 4. Collect or edit fictional orders offline, including a no-drink case.
> 5. Force-quit the official NIIMBOT app, power off other nearby NIIMBOT
>    printers, connect the supplied M2_H, and print short and long labels one at
>    a time. Do not use Print all.
> 6. Inspect every physical label for the correct name and drink, alignment,
>    density, readability, and usable paper output.
> 7. Force-quit with pending work, relaunch offline, restore connectivity, and
>    confirm order changes and printed facts synchronize once without creating
>    a duplicate label or replaying on a second refresh.
> 8. Confirm a competing edit appears as a durable conflict and requires an
>    explicit choice instead of silently overwriting either version.
> 9. For interrupted printing, inspect the paper before choosing: usable paper
>    emerged → Label printed — sync only; nothing emerged → retry; uncertain
>    outcome → stop and inspect before choosing.
> 10. Power-cycle and reconnect the printer, background and resume the app, and
>     exercise Advanced · Legacy link plus the authenticated `/labels`
>     fallback.
> 11. Send crashes or sanitized feedback through TestFlight. Include the
>     iPhone model, iOS version, app build, printer firmware, stock, last
>     successful step, and whether paper emerged. Never send a password,
>     production link, token, or real crew data.

## Exact TestFlight App Review notes

> Capture This is an invitation-only operations app for Capture This coffee
> crews. It has no public sign-up. A reviewer signs in with the fictional
> account supplied in App Store Connect's secure Test Information fields and
> selects the existing Active day named `Apple Review Coffee Run —
> Fictional`. The account, day, roster, and orders will remain active through
> review.
>
> Build 10 uses direct, RLS-protected Supabase access for signed-in operation.
> The app supports order collection and editing, offline cached operation,
> durable replay after connectivity returns, explicit conflict resolution,
> local label previews, and print-recovery states. New days, people, and
> rosters are prepared on the maintained Capture This website and are not
> created in this build.
>
> Physical printing uses the iPhone's Bluetooth permission to discover and
> communicate locally with a NIIMBOT M2_H label printer. Apple is not expected
> to possess this printer. Without hardware, review can inspect sign-in, day
> selection, Collect states, order editing, offline/restored state, label
> previews, conflict UI, recovery guidance, the in-app operating guide,
> privacy/support pages, and Advanced · Legacy link. A sanitized
> fictional-data video or photo may be supplied separately after the physical
> acceptance session.
>
> The supported operating mode is one label at a time. Print all and
> unattended batch printing are a documented limitation and are not part of
> this review request.
>
> Recovery is intentionally conservative. If usable paper emerged but
> synchronization did not finish, the operator chooses Label printed — sync
> only and never reprints it. If nothing emerged, the operator may retry after
> inspection. If the physical result is uncertain, the operator must inspect
> before choosing. A server `label_printed: true` fact is never reset.
>
> Privacy: https://coffee.capturethis.com/privacy
> Support: https://coffee.capturethis.com/support

## Exact demo-account instructions for the secure Test Information fields

> Use the review email and password entered in the secure fields below. Public
> account creation is disabled. After sign-in, select `Apple Review Coffee Run
> — Fictional`; it is already Active and contains only fictional people and
> drinks. Use the reserved review rows and do not reuse a row already marked
> printed. No printer is required to inspect the signed-in day, collect/edit
> orders, label previews, conflict and recovery surfaces, operating guide,
> privacy, support, or fallback entry points. If testing with an M2_H, print
> only one label at a time.

The review username and password belong only in App Store Connect's secure
Test Information fields. A Legacy share URL, if Apple needs it, must be entered
through an explicitly approved secure channel and never committed here.

## Hardware explanation for Apple

The submitted app declares Bluetooth usage because its only supported physical
print path is direct Bluetooth LE communication with a NIIMBOT M2_H. The
accepted local device is asset `M2_H-I409130491`, using 50×30 mm rectangular
holographic stock and app density 3. Firmware and consumable brand/lot are
still to be recorded without updating firmware. Apple is not expected to own
this accessory and physical output is not required to inspect the rest of the
beta.

## Export compliance

The checked-in iOS `Info.plist` declares
`ITSAppUsesNonExemptEncryption = false`. Build 10 uses standard platform HTTPS
and Bluetooth facilities and does not claim non-exempt encryption. The App
Store Connect account owner must make the final export-compliance attestation
from the actual uploaded binary and answer any Apple follow-up truthfully.

## Owner approval block

No App Store Connect write, external-review submission, or tester invitation
is authorized by the copy approval.

The owner approved the beta description, What to Test, review notes, demo
instructions, hardware explanation, and export-compliance draft exactly as
written in the Codex task at 18:42 CDT on 2026-07-27. This approval does not
supply or approve any separate field below and does not authorize production
fixture writes, Beta App Review submission, or a tester invitation.

- Review contact first name: `Kait`
- Review contact last name: `Batts`
- Review phone: **SUPPLIED PRIVATELY 2026-07-27 — APP STORE CONNECT ONLY**
- Review email: **OWNER INPUT**
- Approve `info@capturethis.com` as tester feedback address: **yes/no**
- Buddy first name: **OWNER INPUT**
- Buddy last name: **OWNER INPUT**
- Buddy invitation email: **OWNER INPUT**
- Approve the live privacy/support wording for this beta: **yes/no**
- Secure demo-account provisioning and cleanup owner: **OWNER INPUT**
- Cleanup date or trigger: **OWNER INPUT**
- Approve the beta description, What to Test, review notes, demo instructions,
  hardware explanation, and export-compliance draft exactly as written:
  **YES — approved 2026-07-27 18:42 CDT**

## Submission controls

After the owner approves the packet and the secure production fixture exists:

1. Confirm Build 10 is not marked **TestFlight Internal Only**.
2. Complete TestFlight Test Information using only the approved values.
3. Add Build 10 to `Capture This crew pilot`.
4. Enter the approved What to Test copy.
5. Submit Build 10 for TestFlight App Review.
6. Record the review status and authoritative expiration date.
7. Only after external approval, invite the buddy by email. Do not enable or
   distribute a public TestFlight link.

Stop before a replacement upload. Build 11 is required only if Build 10 is
Internal Only, Apple rejects it in a way that requires a binary change, or a
release-blocking code change is approved.
