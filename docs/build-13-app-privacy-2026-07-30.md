# Build 13 App Privacy evidence

Status: engineering evidence in progress; final App Store Connect answers and
legal/provider attestations remain external factual gates.

Build 13 handles invited-operator email and user ID; day/client/roster/order
content; names, roles, departments, companies, usual orders, dietary and
general notes; private person photos; template configuration; and standard
diagnostic/security request metadata. Data is used for app functionality and
not for tracking.

The final source manifest and App Privacy record must be reconciled with actual
SDK/provider behavior. Specifically solicited names and photos need their Apple
data types. Dietary/private notes must be conservatively reviewed as Health
data unless their product scope is narrowed with evidence. Do not narrow the
diagnostic classification without authoritative Supabase and Vercel evidence.
No analytics, advertising, or crash SDK is being added for this release.

The native cache contains selected-day, roster, order, template, pending-sync,
and print-recovery data in the app sandbox. Supabase session state and legacy
tokens remain in iOS Keychain. Bluetooth discovery and rasterized labels are
processed locally and are not uploaded by the reviewed app code.

## Source manifest

`mobile/ios/Runner/PrivacyInfo.xcprivacy` declares the following as linked to
the user, used for App Functionality, and not used for tracking:

- Email Address
- User ID
- Name
- Photos or Videos
- Health (the conservative classification for dietary/private notes)
- Other User Content
- Other Diagnostic Data

The manifest declares no tracking domains and no accessed-API reason entries.
`ITSAppUsesNonExemptEncryption` remains `false`; archive validation must recheck
that no non-Apple encryption implementation was introduced.

## App Store Connect reconciliation

The live App Privacy form must match the manifest and the actual Supabase and
Vercel data paths. Do not submit narrower answers based only on the absence of
advertising or analytics. Final provider/logging facts, privacy-policy approval,
and the App Privacy attestation require factual owner review before submission.

The public policy at `https://coffee.capturethis.com/privacy` now describes
private photos, dietary/general notes, native preparation, cached templates,
summary sharing, and closeout. Deployment of that copy remains pending the
reviewed Build 13 merge.
