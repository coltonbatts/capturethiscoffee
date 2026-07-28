# Build 11 App Store privacy draft

Prepared: 2026-07-27
Scope: Capture This iOS `1.0.0 (11)`, frozen web fallback, Supabase, and
hosting/security logs
Status: engineering draft only; owner/legal approval and App Store Connect
entry are still required

## Engineering conclusion

The binary does collect data. The prior empty collected-data declaration was
not defensible because invited operators authenticate with Supabase and the app
sends account identifiers, order changes, usual-drink changes, and printed
status to the hosted workspace.

The Build 11 application privacy manifest now declares four data types, each
linked to identity, used for App Functionality, and not used for tracking:

| Apple data type | Evidence in this release | Linked | Purpose | Tracking |
|---|---|---:|---|---:|
| Email Address | Operator submits an email to Supabase Auth and the session exposes it in the app | Yes | App Functionality | No |
| User ID | Supabase account/user ID identifies the signed-in operator and authorizes workspace requests | Yes | App Functionality | No |
| Other User Content | Day-specific drink fields, special notes, no-drink status, optional usual-drink change, and printed status are written to Supabase | Yes | App Functionality | No |
| Other Diagnostic Data | Supabase/Vercel hosting and security logs may associate request metadata or authenticated account identifiers with service operation and abuse prevention | Yes, conservatively | App Functionality | No |

The app contains no advertising SDK, marketing analytics SDK, crash-reporting
SDK, fingerprinting code, or tracking domain. `NSPrivacyTracking` remains
`false`, and the App Store tracking answer should be **No** unless an owner
later adds or discovers contrary behavior.

## Draft App Store Connect nutrition-label answers

Answer **Yes** to “Does this app collect data?” Then enter:

### Contact Info → Email Address

- Collected: **Yes**
- Linked to the user: **Yes**
- Used for tracking: **No**
- Purpose: **App Functionality**
- Reason: invited-account authentication, session identity, and support of
  authorized workspace access

### Identifiers → User ID

- Collected: **Yes**
- Linked to the user: **Yes**
- Used for tracking: **No**
- Purpose: **App Functionality**
- Reason: authenticated session identity and authorization of shared workspace
  operations

### User Content → Other User Content

- Collected: **Yes**
- Linked to the user: **Yes**
- Used for tracking: **No**
- Purpose: **App Functionality**
- Reason: drink orders, order attributes, special notes, no-drink state, usual
  drink updates, conflict-safe edits, and successful printed status

### Diagnostics → Other Diagnostic Data

- Collected: **Yes** as a conservative declaration pending provider-retention
  confirmation
- Linked to the user: **Yes** as a conservative declaration because an
  authenticated request may be correlated to a Supabase user ID
- Used for tracking: **No**
- Purpose: **App Functionality**
- Reason: standard hosting/security request metadata used to operate and protect
  authentication, database, web fallback, and support endpoints

If the owner obtains authoritative Supabase and Vercel configuration evidence
that diagnostic/security logs are not retained or cannot be linked, this last
answer may be narrowed. Do not narrow it from assumption.

## Data processed only on the device

The following does not meet Apple's “collected” definition in the audited
release because it remains on the device and is not sent to Capture This,
Supabase, or Vercel:

- nearby Bluetooth device discovery information and M2_H packets;
- rasterized label preview/output;
- local roster search terms;
- account-scoped board caches;
- selected-day pointer;
- queued offline mutations and single-label recovery state.

The cache and recovery records can contain production, person, and order
content. They are app-sandboxed; the Supabase session/refresh token and any
Legacy token are stored in the iOS Keychain. Local processing is still disclosed
in the privacy policy even though it is not a nutrition-label collection type.

## Data received by the app

The app downloads existing production/client/day metadata, crew names,
roles/departments/company, usual drinks, day orders, and printed state from
Supabase. It renders these on the device and caches a limited number of boards
for offline use. Crew names are not uploaded by the Build 11 iOS edit path;
order and usual-drink writes reference existing server identifiers. The
“Other User Content” declaration covers the content the operator does send.

## SDK and provider audit

- `supabase_flutter` provides Auth/PostgREST access. It receives operator email,
  password during sign-in, session/user ID, database requests, and request
  metadata necessary to serve them.
- `flutter_secure_storage` stores session state locally in Keychain; it does not
  create a Capture This analytics channel.
- `shared_preferences` stores local cache/recovery data; its required-reason API
  declaration comes from the included plugin privacy manifest.
- `flutter_blue_plus` and the pinned `niim_blue_flutter: 1.0.1` support local
  Bluetooth printing. The reviewed app code does not upload discovered
  peripheral details.
- `url_launcher` opens the privacy/support/Legacy URLs only after user action.
- The iOS app has no app-owned required-reason API entry. Included Flutter/plugin
  manifests must be rechecked in every final archive rather than copied into the
  app manifest.

## Account deletion

Build 11 has no account-creation, public-signup, or automatic-account flow in the
app or frozen web UI. Accounts are provisioned by an owner outside the app, and
public signup is disabled. On the current evidence, Apple's rule for apps that
support account creation does not demonstrate a requirement to add in-app
account deletion.

Do not add account creation or deletion UI from this conclusion alone. The owner
or counsel must confirm the distribution model and approve the policy/contact
route. The draft live policy explains that invited operators can request account
or production-data review/deletion through the privacy contact.

## Owner/legal decisions still required

- Approve the exact privacy-policy wording and effective date before deployment.
- Confirm that `info@capturethis.com` is the approved privacy contact and name
  its primary/backup owner.
- Confirm Supabase and Vercel logging, retention, deletion, subprocessors, and
  account plan settings.
- Confirm the conservative diagnostics answer or supply evidence for a narrower
  answer.
- Confirm that no undisclosed analytics, monitoring, advertising, or tracking
  is enabled in provider dashboards.
- Confirm the owner-provisioned/no-account-creation analysis for account
  deletion.
- Make the App Store Connect privacy attestation. Engineering has not entered or
  submitted these answers.

No production privacy/support page was deployed during this hardening pass.

## Local verification — 2026-07-28

- `plutil -lint mobile/ios/Runner/PrivacyInfo.xcprivacy` passed.
- The preserved local Build 11 archive and IPA contain six application,
  Flutter, and plugin privacy manifests. Each parsed successfully and the app
  manifest matched the four linked/App Functionality/not-tracking declarations
  above.
- Flutter declares the File Timestamp and System Boot Time required-reason
  categories; Shared Preferences declares User Defaults. The other embedded
  plugin manifests contain no collected-data or tracking declarations.
- Source review found sign-in, session refresh, and sign-out, but no mobile or
  web public-signup/account-creation action.
- No supported command-line Xcode privacy-report generator was available. An
  Organizer privacy report has therefore not been treated as passed; the
  release operator must generate and review it from the final committed
  archive.
