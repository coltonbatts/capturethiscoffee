# Build 11 external TestFlight and App Review packet

Prepared: 2026-07-27
Status: **DRAFT — BUILD NOT UPLOADED, OWNER APPROVAL/PRIVATE VALUES REQUIRED**
App: Capture This (`App Store Connect` record currently documented as
`Capture This Printer`)
Version/build: `1.0.0 (11)`
Bundle ID: `com.capturethis.ctcprinter`
External group: `Capture This crew pilot`
Privacy: `https://coffee.capturethis.com/privacy`
Support: `https://coffee.capturethis.com/support`

This packet supersedes the Build 10 copy only if the owner approves it and
authorizes use with an uploaded Build 11. It does not authorize an upload,
production fixture, App Store Connect write, tester invitation, Beta App Review,
App Review, or unlisted-distribution request.

## Beta app description

> Capture This helps an invited coffee-crew operator collect drink orders for
> an existing Active day and print individual cup labels directly from an
> iPhone to a NIIMBOT M2_H over Bluetooth. Build 11 supports
> owner-provisioned sign-in, existing-day selection, offline order collection,
> durable synchronization, visible conflict handling, local label previews,
> and duplicate-safe single-label recovery. There is no public signup. Day,
> people, and roster setup remain on the maintained Capture This website.
> This release prints and verifies one label at a time.

## What to Test

> 1. Install Capture This and confirm `1.0.0 (11)` in About.
> 2. Sign in with the fictional account supplied privately and select `Apple
>    Review Coffee Run — Fictional`, an existing Active day.
> 3. Load online, force-quit, restore the signed-in day, then cold-start it in
>    Airplane Mode with Bluetooth retained.
> 4. Make at least three fictional order edits offline, including a no-drink
>    case. Relaunch with them pending, restore connectivity, and confirm each
>    synchronizes exactly once.
> 5. Exercise both conflict choices, `Use phone version` and `Keep server`, on
>    reserved fictional rows. Confirm neither version is silently overwritten.
> 6. If you have the supplied M2_H, force-quit the official NIIMBOT app, power
>    off other nearby NIIMBOT printers, and print short and long labels
>    individually. Inspect each physical label before proceeding.
> 7. Deliberately interrupt one individual print. Inspect the paper before
>    choosing `Label printed — sync only` or `Nothing printed — retry`; confirm
>    no duplicate.
> 8. Confirm Planning and Complete days refuse printing, then check haptics,
>    Reduce Motion, printer power-cycle/reconnect, background/resume,
>    `Advanced · Legacy link`, and the authenticated `/labels` fallback.
> 9. Send only sanitized feedback: iPhone/iOS, app build, printer firmware,
>    stock, last completed step, exact error, and whether paper emerged. Never
>    send a password, token, private link, or real crew data.

## TestFlight/App Review notes

> Capture This is an invitation-only operations app for Capture This coffee
> crews. It has no public signup or in-app account creation. Use the stable
> fictional credentials entered in App Store Connect's secure review fields,
> then select the existing Active day `Apple Review Coffee Run — Fictional`.
> The account/day will remain available throughout review and contains only
> fictional people and drinks.
>
> Review does not require a NIIMBOT M2_H. Without the accessory, Apple can
> inspect invited-account sign-in, existing-day selection, Collect and edit
> flows, offline/restored state, pending replay, conflict protection, local
> label previews, duplicate-safe recovery choices, Planning/Complete refusal,
> in-app help/About, privacy/support links, and the Legacy entry point.
>
> If hardware is available, the supported workflow is direct Bluetooth LE to a
> NIIMBOT M2_H using 50×30 mm stock, one label at a time. The app never claims
> a physical outcome automatically:
> after an interrupted print the operator must inspect the paper. Usable paper
> means `Label printed — sync only`; no paper means retry. A hosted
> `label_printed: true` fact is irreversible and is never reset.
>
> The app can collect and edit orders while offline after a day has been loaded.
> Pending work is persisted across relaunch, replays when connectivity returns,
> and stops on a visible conflict instead of overwriting another operator.
>
> New days, people, and rosters are prepared on the maintained Capture This web
> fallback and are intentionally outside this scoped release.
>
> Privacy: https://coffee.capturethis.com/privacy
> Support: https://coffee.capturethis.com/support

## Secure demo-account instructions

> Use the username/password in the secure review fields. Public account
> creation is disabled. Select `Apple Review Coffee Run — Fictional`; it is
> Active and contains only fictional content. Use reserved review rows and do
> not reuse any row already marked printed. No printer is required for the
> product surfaces listed in Review Notes. If testing with an M2_H, print only
> one label at a time.

The username, password, production UUID, and optional Legacy URL belong only in
App Store Connect's secure fields or another owner-approved private channel.
Never commit or place them in free-form review notes.

## Hardware and export-compliance explanation

Bluetooth is used only to discover and communicate locally with a NIIMBOT M2_H.
Apple is not expected to own the accessory. The local accepted asset is
`M2_H-I409130491` with rectangular holographic 50×30 mm stock and app density
`3`; firmware/ribbon/lot remain physical-session blanks and must not be
invented.

`Info.plist` declares `ITSAppUsesNonExemptEncryption = false`. The app uses
standard platform HTTPS and Bluetooth facilities and contains no known custom
non-exempt cryptography. This is an engineering draft, not the owner's export
attestation.

## App Store privacy summary

Use
[`app-store-privacy-build-11-2026-07-27.md`](app-store-privacy-build-11-2026-07-27.md).
The draft answer is:

- Data collected: **Yes**
- Email Address: linked, App Functionality, no tracking
- User ID: linked, App Functionality, no tracking
- Other User Content: linked, App Functionality, no tracking
- Other Diagnostic Data: linked conservatively, App Functionality, no tracking
- Tracking: **No**

Owner/legal approval and App Store Connect entry remain required.

## Completeness and owner/private-value register

| Required value or decision | Current status |
|---|---|
| Tester feedback email | Missing; `info@capturethis.com` was declined for Build 10 |
| Review contact name | Kait Batts documented; reapprove for Build 11 |
| Review contact phone/email | Previously supplied privately; reverify in App Store Connect, never commit |
| Privacy-policy wording/effective date/contact | Owner/legal approval missing; source edit not deployed |
| Support wording/contact/response owner | Owner approval and named mailbox owners missing; source edit not deployed |
| Fictional review account | Production provisioning not authorized |
| Account provisioning/cleanup owner and trigger | Missing |
| Stable fictional Active day and reserved rows | Planned, not authorized or verified |
| Optional Legacy fixture/revocation owner | Missing |
| External tester name/email | Missing |
| Age-rating questionnaire | Owner attestation missing |
| Content rights for app/icon/screenshots/fictional copy | Owner attestation missing |
| Export compliance | Owner attestation missing |
| Categories/subtitle/keywords/copyright | Owner decision/verification missing |
| Countries/regions | Owner decision missing |
| Price | Owner decision missing |
| Release method | Owner decision missing; manual release is recommended |
| Unlisted-distribution eligibility/request approval | Owner approval missing |
| App Store Connect app-name reconciliation | Owner decision; documented record still says Capture This Printer |
| Support owner and backup | Missing |
| iOS replacement-build/release owner and backup | Missing |
| Web/Supabase/Vercel security/operations owners | Missing |
| Dependency-risk owner/acceptance | Missing |
| Build 11 upload, beta review, tester invite, permanent review | Each requires separate explicit authorization |

## Read-only packet audit

Present locally:

- Build 11 identity source and drift regression;
- single-label-only shipping UI and regression coverage;
- privacy-manifest correction and nutrition-label draft;
- current fictional screenshot package;
- physical Build 11 worksheet;
- review copy explaining invitation-only access, no-printer inspection,
  offline/recovery behavior, and privacy/support URLs;
- planned fictional fixture specification.

Not established:

- live Build 11 upload/processing;
- live App Store Connect field state;
- owner/legal attestations;
- authorized/working production review credentials and Active day;
- completed physical Build 11 acceptance;
- Beta App Review, external tester, pilot outcome, permanent App Review, or
  unlisted-distribution approval.

No App Store Connect or production write was made during this audit.
