# App Store installation and replacement builds

Status: pending approved unlisted release.

The intended operator installs Capture This from the verified unlisted App
Store link, then signs in with an individually provisioned account. The link
may be forwarded, so authentication remains required.

## Install from the unlisted link

1. The release owner sends the verified direct App Store link privately. An
   unlisted app is not expected to appear in App Store search, charts,
   categories, or public browsing.
2. On the supported iPhone, open the link, confirm the seller and app name are
   the approved Capture This record, then install through the App Store.
3. Open Capture This and confirm the released version/build in **About**.
4. Sign in with the operator's individual owner-provisioned account. Do not
   share an Apple Account or Capture This password.
5. Select a fictional or approved production, refresh, and confirm the expected
   label-template name/version and support/privacy links.
6. Before production use, complete the exact physical acceptance that applies
   to this binary and kit. App Store installation alone does not prove printer
   behavior.

If the direct link opens a public searchable record, an unexpected seller/app,
or a different build than the release ledger, stop and contact the release
owner.

## Replace an iPhone

1. Confirm the unlisted version is still available and the operator's account
   remains active.
2. Install from the same verified direct link on the replacement iPhone.
3. Sign in individually and select the intended day.
4. Load the day/template online once before testing cached offline behavior.
5. Pair only the accepted M2_H after force-quitting the official NIIMBOT app and
   powering off other NIIMBOT printers.
6. Repeat affected install, cache, Bluetooth, one-label, recovery, and fallback
   checks before the replacement phone enters service.

App data cached only on the retired phone is not a backup. The Supabase board
is authoritative; unresolved physical print outcomes must be reconciled before
the device changes.

## Produce a replacement build

Every replacement binary must:

1. Start from reviewed merged source.
2. Use a unique build number.
3. Preserve the bundle ID and signing team unless a separately reviewed
   transfer requires otherwise.
4. Run the full web, schema, Flutter, screenshot, archive, and affected
   physical gates.
5. Upload through the normal App Store Connect path.
6. Reverify privacy, metadata, review fixture, production configuration,
   entitlements, and absence of debug/service-role values.
7. Use manual release control and preserve unlisted distribution.

After upload, wait for processing, install the exact candidate through the
authorized verification channel, repeat the affected physical gate, submit the
new version/build to App Review when required, and release manually only while
the app's distribution state remains Unlisted. Record the replacement's source
commit, PR/merge, database compatibility, deployment, archive/IPA hash, App
Store Connect build ID, review result, release time, and clean-phone install.

Never reuse a build number, change the bundle ID/team casually, create a public
TestFlight link, or rely on an expired TestFlight build as the permanent
replacement-device plan.

The final unlisted URL, release identity, archive/IPA hash, processing state,
physical evidence, and installation result will be recorded after approval.
