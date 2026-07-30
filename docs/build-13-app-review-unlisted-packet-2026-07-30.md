# Build 13 App Review and unlisted-distribution packet

Status: draft pending final binary, live metadata, fictional fixture, physical
acceptance, factual private fields, and Apple review.

## Product

Capture This is an authenticated operational tool for a limited production
crew and business-affiliate audience. It prepares shoot days, manages people
and rosters, collects coffee orders, renders and prints individual cup labels
to a supported NIIMBOT M2_H, shares shop summaries, and closes completed days.

There is no public signup. The app is free, manually released, and intended for
unlisted rather than searchable App Store distribution.

## Reviewer path without a printer

1. Sign in with the persistent fictional credentials supplied only in App
   Store Connect's secure review fields.
2. Select the fictional Planning day to inspect people, roster, and template
   assignment.
3. Select the fictional Active day to collect orders, review current/cached
   template state, preview labels, view grouped and by-person summaries, and
   open the native share sheet.
4. Review guarded closeout messaging without completing data needed by another
   reviewer.
5. Open in-app Help, Privacy, and Support.

The NIIMBOT M2_H is optional for the non-hardware path. If available, the app
prints one 50×30 mm label at a time over Bluetooth LE. It never treats an
uncertain printer acknowledgement as proof that paper emerged.

## Secure fixture

Credentials, user UUIDs, production UUIDs, share tokens, and private contact
values must never be committed here. Record only:

- Persistent fictional review account verified: pending
- Fictional Planning day verified: pending
- Fictional Active day verified: pending
- Short/long/minimal/maximum label rows verified: pending
- Cleanup/retention owner: pending

## Metadata draft

- Name: Capture This
- Subtitle: Production coffee, organized
- Primary category: Business (verify against live record)
- Secondary category: Productivity
- Price: Free
- Availability: United States initially
- Release method: Manual
- Privacy: `https://coffee.capturethis.com/privacy`
- Support: `https://coffee.capturethis.com/support`
- Distribution: Unlisted request required before release

Final description, keywords, promotional text, age rating, content rights,
export compliance, reviewer contact, copyright, and legal attestations must be
verified against the live record and factual owner inputs.

### Promotional text

Prepare production coffee days, collect orders, print individual cup labels,
and share a clear closeout summary from one operator workspace.

### Description

Capture This keeps production coffee service organized from preparation
through closeout.

Invited operators can:

- prepare production days, people, and on-set rosters;
- collect and update coffee orders;
- review grouped and by-person summaries;
- synchronize a published label design assigned to the day;
- preview and print one 50×30 mm cup label at a time to a supported NIIMBOT
  M2_H over Bluetooth;
- keep collecting and printing from a previously loaded day when connectivity
  is interrupted;
- resolve order conflicts and uncertain print outcomes without silently
  duplicating a label;
- share the day summary with the iOS share sheet; and
- complete an eligible day after every on-set order is decided and every
  captured label is printed.

Capture This is an authenticated business tool. Accounts are provisioned by the
account owner; public signup is not available. A compatible printer is optional
for reviewing the preparation, collection, preview, summary, and closeout
guards.

### Keywords

`production,coffee,crew,orders,labels,roster,shoot,runner`

### What's New in This Version

Build 13 completes the Capture This operating loop with versioned label
designs, exact on-device previews, cached offline rendering, grouped and
by-person summaries, native sharing, and a guarded day closeout. Printing
remains deliberately one label at a time with duplicate-safe recovery.

### Review notes

Capture This is intended for unlisted distribution to a limited production
crew and business-affiliate audience. It is free and has no in-app purchases.
Public signup is disabled.

Use the persistent fictional account in the secure Sign-In Information fields.
The fictional Planning day demonstrates native setup and template assignment.
The fictional Active day demonstrates collection, label preview, offline/cached
state, grouped and by-person summaries, the iOS share sheet, and guarded
closeout. Please do not complete the shared Active fixture unless the notes in
App Store Connect explicitly mark it disposable for this review.

The NIIMBOT M2_H is optional for the non-hardware review path. The printer flow
is one label at a time and the UI remains truthful when no printer is connected.
A review video may be supplied privately if Apple requests hardware evidence.

Label templates are authenticated declarative JSON data only. They use a fixed
591×354 canvas, bundled Arial, bounded black/white drawing primitives, and a
small fixed set of text bindings. The app rejects unknown schema versions,
unknown fields, URLs, remote assets, scripts, JavaScript, Dart, CSS, scripted
SVG, WebAssembly, plugins, and any other executable behavior. Template updates
cannot introduce or change app code (Guideline 2.5.2).

The app uses Bluetooth only to discover and communicate with the supported
printer. It uses the camera or photo library only when an invited operator
chooses a private crew photo. Export compliance is recorded as no nonexempt
encryption, subject to final binary verification.

### Provisional questionnaire positions

- Primary category: Business
- Secondary category: Productivity
- Age rating: expected 4+ based on reviewed product content; answer every live
  questionnaire item factually
- Sign in with Apple: not used; the app uses owner-provisioned business
  accounts for enterprise-style operational features
- Account deletion in app: not applicable because accounts cannot be created
  in the app; the privacy/support contact accepts access and deletion requests
- Content rights, copyright/legal entity, review contact, trader status, and
  agreements: private/legal owner inputs, not inferred here

## Screenshot set

The Build 13 source set contains nine fictional 1320×2868 iPhone screenshots:

1. invited-account sign in;
2. existing day selection;
3. order collection;
4. individual print deck and exact local label preview;
5. offline conflict protection;
6. duplicate-safe uncertain-print recovery;
7. About, privacy/support, and `1.0.0 (13)` identity;
8. grouped summary, by-person state, share control, and guarded closeout; and
9. assigned template identity/status, exact preview, and the no-facts fictional
   test-label action.

App Store Connect may use up to ten. Order the live set around the operational
experience: lead with day selection or collection, not blank sign-in.

## Unlisted release sequence

1. Create the ordinary App Store version with United States availability and
   manual release.
2. State the unlisted-distribution intent in Review Notes.
3. Submit the final binary and metadata to App Review.
4. After the version is submitted, send Apple's unlisted-app request.
5. Wait for both App Review acceptance and unlisted-distribution approval.
6. Confirm the App Store distribution state is Unlisted before manual release.
7. Release manually, verify the direct link, install on a clean supported
   iPhone, sign in, and record the exact released version/build.

Never release while the record is publicly searchable. Do not create a public
TestFlight link.

## Authoritative Apple checks used for this packet

- [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [App Review](https://developer.apple.com/app-store/review/)
- [Unlisted app distribution](https://developer.apple.com/support/unlisted-app-distribution/)
- [App privacy details](https://developer.apple.com/app-store/app-privacy-details/)
- [Manage App Privacy](https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy)
- [Screenshot specifications](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/)
- [App Store categories](https://developer.apple.com/app-store/categories/)
- [Age-rating values and definitions](https://developer.apple.com/help/app-store-connect/reference/app-information/age-ratings-values-and-definitions/)
- [Account deletion guidance](https://developer.apple.com/support/offering-account-deletion-in-your-app)
- [Export compliance overview](https://developer.apple.com/help/app-store-connect/manage-app-information/overview-of-export-compliance)
- [Manual release option](https://developer.apple.com/help/app-store-connect/manage-your-apps-availability/select-an-app-store-version-release-option)
- [EU Digital Services Act trader requirements](https://developer.apple.com/help/app-store-connect/manage-compliance-information/manage-european-union-digital-services-act-trader-requirements/)
- [Agreements](https://developer.apple.com/help/app-store-connect/manage-agreements/sign-and-update-agreements/)
