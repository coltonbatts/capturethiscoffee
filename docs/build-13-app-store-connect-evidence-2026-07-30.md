# Build 13 App Store Connect evidence

Date: 2026-07-30

Release identity: `1.0.0 (13)`

App Store app ID: `6786807268`

App Store Connect build ID: `79ca63c6-38b1-43d6-af1e-d0f4b2d44e47`

This record captures the authenticated App Store Connect state after Build 13
metadata preparation. It does not represent App Review submission, unlisted
approval, physical acceptance, or release.

## App record and version

- The App Store record is named **Capture This Coffee**. Apple rejected the
  exact storefront name **Capture This** as already in use; the product and
  installed experience continue to identify the app as Capture This.
- Version `1.0` has Build 13 attached.
- The subtitle is **Production coffee, organized**.
- The primary category is Business and the secondary category is Productivity.
- Promotional text, description, keywords, support URL, marketing URL, secure
  review credentials, and review notes are saved.
- Nine fictional 1320×2868 iPhone screenshots are saved in the 6.9-inch slot.
  The first three are existing days, order collection, and the individual
  print deck.
- The live age-rating questionnaire calculates **4+**.
- Release is set to **Manual**.

## Pricing, availability, and device storefronts

- The starting price is free with the United States as the base region.
- Availability is limited to the United States: one region available on app
  release and 174 regions unavailable.
- Apple silicon Mac availability is disabled because Build 13 was not accepted
  on Mac.
- Apple Vision Pro availability is disabled because Build 13 was not accepted
  on Vision Pro.
- The Apple School Manager reduced-price option is disabled.
- The ordinary Public distribution method remains selected because Apple's
  unlisted process starts from an ordinary public App Store configuration.
  Manual release prevents an automatic searchable release. Do not release
  until Apple approves unlisted distribution and the record is confirmed
  unlisted.

## Build 13 and TestFlight

- Upload processing is **Complete** and the binary state is **Validated**.
- App Store Connect reports bundle `com.capturethis.ctcprinter`, version
  `1.0.0`, build `13`, iPhone device family, arm64, and minimum iOS 13.0.
- Build metadata reports **App Uses Non-Exempt Encryption: No** and
  `get-task-allow: false`.
- Build 13 is assigned only to the internal **Main** group
  (`44678fa3-60ec-4971-9c1a-73b768e8a198`), which has one tester.
- Build 13 is not assigned to the existing external group. No public TestFlight
  link was created.
- Build 13 tester guidance is saved and explicitly calls for individual,
  one-label-at-a-time printing and preserving the shared review fixture.
- Installation and physical acceptance are still unverified.

## App Privacy draft

The conservative repository-backed draft is complete but unpublished. It
declares these seven data types:

- Name
- Email Address
- Health
- Photos or Videos
- Other User Content
- User ID
- Other Diagnostic Data

Every type is configured as linked to the user, used only for App
Functionality, and not used for tracking. **Publish was not clicked.** An Admin
must review the final provider/logging facts and publish the declaration.

The live privacy policy at `https://coffee.capturethis.com/privacy` returns
HTTP 200. App Store Connect still shows the Privacy Policy URL as unset because
its edit dialog did not enable Save after the URL was entered. Resolve this
while completing the owner-reviewed privacy publication.

## App Store validator and remaining gates

**Add for Review** was used only to run App Store Connect validation; no review
submission was created. The validator reported:

1. copyright information is required; and
2. an Admin must provide the app's privacy practices in App Privacy.

Copyright ownership text is an owner/legal fact and was not inferred. The App
Privacy publication is an owner/provider attestation and was not published.
Reviewer contact fields, content-rights status, DSA trader status, agreements,
and physical acceptance also remain owner-controlled facts even though the
current Add for Review validator did not surface all of them.

No App Review submission, unlisted-app request, searchable App Store release,
or manual release was performed.
