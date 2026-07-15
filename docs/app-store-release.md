# Capture This — App Store release dossier

Last updated: 2026-07-15

This is the working metadata package for the iPhone-only `1.0.0 (5)` release
candidate. Values marked **OWNER APPROVAL** must be approved or completed in
App Store Connect by the account owner. Production share URLs and tokens must
never be committed here.

## Product record

| Field | Proposed value |
|---|---|
| App name | Capture This |
| Subtitle | Coffee labels for crews |
| Bundle ID | `com.capturethis.ctcprinter` |
| Version / build | `1.0.0 (5)` |
| Platform | iPhone only |
| Minimum iOS | iOS 13.0 |
| Primary language | English (U.S.) |
| Primary category | Productivity |
| Secondary category | Utilities |
| Privacy policy URL | `https://coffee.capturethis.com/privacy` |
| Support URL | `https://coffee.capturethis.com/support` |
| Distribution | Public App Store configuration, then approved Unlisted App request |
| Release control | Manual release |
| Price | Free |
| Copyright | **OWNER APPROVAL:** `© 2026 Capture This` |

The App Store record may still be named **CTC Printer**. Rename it to
**Capture This** before screenshots or review so the App Store, installed app,
support pages, and documentation agree.

## Store description

Capture This is the coffee-label printing companion for Capture This
production crews.

Open a production share link provided by your Capture This coordinator, review
the pending coffee-label queue, connect a NIIMBOT M2_H over Bluetooth, and print
server-rendered labels directly from an iPhone. Successful prints synchronize
back to the production board. If a label prints but synchronization is
interrupted, Capture This preserves the result and offers a sync-only recovery
so the operator does not unknowingly print a duplicate.

This app is designed for invited Capture This crews, contractors, partners,
and friends. It does not offer public account creation. A valid production
share link is required for production data, and physical printing requires a
NIIMBOT M2_H and compatible label stock.

## Keywords

`coffee,production,crew,labels,printer,on-set,NIIMBOT,catering`

## App Review notes

Capture This is a companion app for Capture This Coffee production crews. It
does not provide public sign-up or a consumer account flow. Access to a
production is granted by a token-scoped HTTPS production share URL provided by
the production coordinator.

Reviewers can paste the fictional review production URL supplied in the secure
App Review Information field to load and inspect the label queue. The review
production will remain active for the review period and contains only fictional
crew names and drink orders. Do not place that URL in Review Notes because its
token grants access to the fixture.

Bluetooth printing requires a NIIMBOT M2_H, which Apple is not expected to
own. The queue, label previews, recovery states, privacy page, support page,
and licensing information remain inspectable without a printer. A short video
showing the same build printing and synchronizing on a physical M2_H may be
attached to the review submission.

This submission is intended for **unlisted App Store distribution**. It is for
a limited audience of Capture This crews, contractors, partners, and friends,
including unmanaged personal iPhones. The app is intentionally not intended to
be searchable or publicly discoverable. The backend will remain available
throughout review.

## Review contact placeholders

- First and last name: **OWNER INPUT**
- Phone: **OWNER INPUT**
- Email: **OWNER INPUT**
- Secure review production URL: **APP STORE CONNECT ONLY**
- Demo video attachment: **PENDING PHYSICAL TEST**

## External TestFlight metadata

**Beta description**

Capture This connects to a NIIMBOT M2_H over Bluetooth and prints coffee labels
from a token-scoped Capture This production share link. This pilot validates
installation, production linking, printing, interruption recovery, and web
synchronization before the permanent unlisted App Store release.

**What to test**

1. Install on an iPhone and open the supplied fictional production URL.
2. Confirm the pending label queue loads and refreshes.
3. Force-quit the official NIIMBOT app, then connect exactly one M2_H.
4. Print short, long, and batch labels; verify every successful print syncs.
5. Interrupt one batch, reconnect, and verify sync-only recovery prevents an
   accidental duplicate.
6. Send the phone/iOS, printer firmware, stock dimensions, and observed result
   to the feedback email.

**Feedback email:** `info@capturethis.com` (**OWNER APPROVAL**)

## Privacy answers — draft for owner approval

These are a conservative drafting aid, not a legal attestation. Recheck every
answer in App Store Connect against the final build and privacy policy.

- Tracking: **No**. No advertising SDK, cross-app tracking, or advertising
  identifier use is present in the release candidate.
- Account creation: **No**. The app accepts an operational production share
  URL; public Supabase sign-up remains disabled.
- Data used for app functionality: the production share token, production and
  order identifiers, crew names, drink orders, and print-status updates.
- Data linked to identity: **OWNER/LEGAL DECISION.** Crew names identify crew
  members in the production context. The share token identifies a production,
  not an App Store user, but should still be treated as sensitive access data.
- Local storage: the linked session/token is stored in the iOS Keychain;
  unresolved print/sync recovery state is stored locally on the device.
- Bluetooth: communication is local between the iPhone and NIIMBOT M2_H.
- Crash/error monitoring: none is integrated in build 5. Revisit the answers
  if monitoring is added.
- Retention/deletion: governed by the Capture This backend policy; requests go
  to `info@capturethis.com`. The owner must approve the stated retention and
  deletion process before submission.
- Third-party code: Flutter, Supabase-backed web APIs, Vercel hosting,
  `niim_blue_flutter`, secure storage, shared preferences, HTTP, and URL
  launcher behavior must be included in the assessment.

## Compliance and ratings — draft

- Export compliance: `ITSAppUsesNonExemptEncryption` is `false`; the app uses
  standard HTTPS and platform Bluetooth facilities. Answer any App Store
  follow-up truthfully; **OWNER ATTESTATION REQUIRED**.
- Age rating: no user-generated social feed, gambling, contests, commerce,
  medical content, violence, sexual content, profanity, or unrestricted web
  browsing is designed into the app. Complete Apple’s current questionnaire
  from actual product behavior; **OWNER ATTESTATION REQUIRED**.
- Content rights: Capture This owns or has permission to use the app name,
  icons, screenshots, and displayed fictional review data;
  **OWNER ATTESTATION REQUIRED**.
- Third-party notices are available from the in-app Licenses screen and the
  Flutter-generated notice bundle.

## Screenshot and video package

Use real build-5 screens and fictional review data. Capture at least:

1. Link a production.
2. Pending label queue with short and long fictional orders.
3. Connected M2_H and print controls.
4. Successful synchronization / printed state.
5. Sync-only recovery after an interrupted server update.

Provide the largest accepted iPhone portrait size in App Store Connect and
confirm the uploaded set passes Apple’s current screenshot validator. Do not
include a real production token, notification content, personal crew data, or
an Apple device frame that implies unsupported hardware. A 15–30 second demo
video may show link → connect → print → synced web state, with the token area
cropped or blurred.

Three provisional, truthful 6.9-inch portrait screenshots are prepared in
`docs/app-store-assets/iphone-6.9/`. Each is 1320×2868 PNG with no alpha channel
and uses only a non-shipping fictional fixture. They show production linking,
the pending queue, and duplicate-safe print/sync recovery. They do not fabricate
a connected printer. After the physical gate, add or replace one asset with the
tested M2_H connected/printing state if it improves reviewer understanding.

## Submission order

1. Approve privacy/support wording and deploy the release commit.
2. Create the non-expiring fictional review production and enter its URL only
   in App Store Connect.
3. Upload build 5 and complete beta metadata.
4. Complete external TestFlight and the physical pilot; upload a higher build
   if any release-blocking fix is needed.
5. Complete App Store metadata, privacy answers, rating, contact, screenshots,
   and manual-release selection.
6. Configure normal public App Store distribution as Apple requires for the
   request, submit the production build to App Review, and state the unlisted
   intent in Review Notes.
7. Submit Apple’s unlisted-app request. Do not call the app unlisted until Apple
   changes Pricing and Availability to **Unlisted App** and generates the link.
8. After approval, manually release, verify the direct link, install cleanly,
   and run the final physical smoke test.
