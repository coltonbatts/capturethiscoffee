# Capture This release and operations handoff

Last updated: 2026-07-30

This handoff grants roles, not shared passwords. Fill the ownership and renewal
register with the account holders before the printer moves. The intended operator's one-page
operating guide is [Operator Quick Start](operator-quick-start.md). The role-based entry
point and definition of done are in [the handoff hub](HANDOFF.md).

## Source and release

- GitHub: `https://github.com/coltonbatts/capturethiscoffee`
- Production branch: `main`
- Current internal TestFlight build: Build 12, `1.0.0 (12)`, uploaded,
  processed, assigned only to the existing internal `Main` group, and reported
  installed by its one existing tester. See
  [`build-12-native-setup-2026-07-29.md`](build-12-native-setup-2026-07-29.md).
- Current release candidate: Build 13, `1.0.0 (13)`. It adds versioned label
  templates, immutable per-day template snapshots, an operator summary/share
  surface, and server-authoritative closeout while preserving one-label-at-a-time
  printing. Its exact source, verification, promotion, physical, and Apple
  state belong in
  [`build-13-app-store-launch-2026-07-30.md`](build-13-app-store-launch-2026-07-30.md).
- Until that launch record says otherwise, Build 13 is not merged, deployed,
  uploaded, physically accepted, approved, or released.
- Release tag: create `capture-this-v1.0.0` only after the physical and external
  pilot gates pass; record the exact commit in `release-evidence-1.0.0.md`.
- Never commit `.env.local`, share URLs/tokens, Apple credentials, temporary
  passwords, service-role keys, or `docs/*.local.md`.

Web verification:

```bash
npm ci
npm test
npm run lint
npm run build
npm run verify:niimbot-export
npm audit --omit=dev
```

iOS verification and archive:

```bash
cd mobile
flutter pub get
flutter analyze
flutter test
flutter build ios --simulator --no-codesign
flutter build ipa --release --export-options-plist=ios/ExportOptions.plist
```

Increase the `version:` build suffix in `mobile/pubspec.yaml` for every upload.
Increase the marketing version only for a new App Store version. Preserve the
exact `niim_blue_flutter: 1.0.1` pin unless an M2_H regression plan and physical
printer are available. The checked-in export options deliberately prevent Xcode
from silently rewriting the IPA build number. Before upload, confirm the
archive, IPA, `pubspec.yaml`, and App Store Connect all use the intended unique
build number.

## Web production

- Vercel project: `capturethiscoffee`
- Production domain: `coffee.capturethis.com`
- Current production deployment and commit are recorded in the release evidence.
- Production environment requires `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and server-only
  `SUPABASE_SERVICE_ROLE_KEY`. Verify names/targets in Vercel without copying
  values into docs or chat.
- Push a reviewed release commit to the production-linked branch, wait for
  Vercel READY, then verify root, privacy, support, signed-out redirects, public
  API denial, a valid disposable token, and sanitized server errors.
- Rollback: promote the last known-good Vercel deployment. If schema changed,
  use the database recovery plan rather than assuming a web rollback reverses
  data migrations.
- Template authoring/publishing is an authenticated operator function. A draft
  does not affect production. Publish only after exact geometry/export preview,
  semantic validation, and operator review. Keep Grid 01 as the production
  default until non-Grid physical acceptance is complete.

## Supabase operations

- Project owner/organization: **OWNER REGISTER**
- Apply `supabase/schema.sql` for a fresh project and all files in
  `supabase/migrations/` in filename order. Record each applied migration.
- Build 13's additive migration and recovery boundary are documented in
  [`build-13-database-migration-and-rollback.md`](build-13-database-migration-and-rollback.md).
  Never apply it to a shared environment before its disposable full-history
  replay, static contract tests, and target-project plan are clean.
- Confirm `orders` is present in the `supabase_realtime` publication.
- Keep public email sign-ups disabled. Invite operators deliberately; current
  signed-in operators share full workspace access. Public settings reported
  `disable_signup: true` on 2026-07-23; the dashboard owner must still record
  who may invite and remove operators.
- Confirm RLS denies anonymous direct access to core tables. The service-role
  key stays server-side and should be rotated after suspected exposure.
- Production links are generated from the production UI. Treat them as bearer
  credentials: send privately and replace compromised links. The current UI
  issues links but does not revoke them; a named Supabase operator must set
  `revoked_at` through approved dashboard/database access and verify the old URL
  returns a denied response.
- Backup policy: **OWNER MUST CONFIGURE/RECORD** the Supabase plan, PITR or daily
  backup capability, retention window, last restore drill, and responsible
  person. Before destructive migrations, take/export a verified backup. Test a
  restore to a non-production environment at least quarterly.
- Recovery priority: restore database authority first, then redeploy the known
  matching web commit, verify RLS and token behavior, and rotate exposed tokens.

## Day-of production

1. A signed-in web or native operator creates the Planning day and roster. A
   web operator selects a published label template before activation when the
   default is not intended; activation snapshots that immutable version.
2. Confirm the production is Active and test any fallback link in a private
   browser.
3. The printer operator installs Capture This, signs in with the individual
   owner-provisioned account, selects the existing Active day, force-quits the
   official NIIMBOT app, and powers off other nearby NIIMBOT printers.
4. Connect only the physically verified M2_H. Do not update printer firmware.
   Print and physically verify one label at a time.
5. If a print succeeds but sync fails, do not tap Print again. Use **Sync only**.
   If the outcome is uncertain, inspect the printer/physical label and choose
   **Label printed — sync only** or **Nothing printed — retry**.
6. Open **Summary & closeout**, reconcile grouped quantities and every
   per-person state, and share the fictional/sanitized summary if required.
   Closeout is online-only and must remain blocked while any order is waiting,
   captured but unprinted, pending sync, conflicted, or awaiting physical-print
   recovery.
7. Complete the day through the guarded server action; a completed day is
   immutable and cannot be reopened.
8. Keep the authenticated `/labels` PNG/CSV flow as the fallback.
9. Follow [Operator Quick Start](operator-quick-start.md) for the exact
   day-of sequence.

## Apple operations

- Apple Developer/App Store Connect Account Holder: **OWNER REGISTER**
- Team ID: recorded in the Xcode project; do not share signing credentials.
- Bundle ID: `com.capturethis.ctcprinter`
- Minimum roles: give a release operator only the App Manager or Developer role
  needed for their work; the Account Holder retains agreements, membership,
  transfers, and legal authority.
- Invite internal users under Users and Access. Do not invite testers, create a
  public TestFlight link, or submit external beta review unless a separate
  authorized pilot requires it.
- Upload each unique build through Xcode/Transporter. Record processing status,
  export-compliance response, group, feedback, fixes, and replacement build.
- For an update: bump build/version, run all checks, repeat affected physical
  tests, upload, pilot externally, update metadata/privacy answers, submit, and
  preserve manual release control.
- For Build 13's durable path, use the exact sequence in the
  [App Review/unlisted packet](build-13-app-review-unlisted-packet-2026-07-30.md):
  finish legal/privacy/account attestations, upload the validated build, enter
  metadata and private review access, select manual release and the intended
  storefront, submit for ordinary App Review, then request unlisted
  distribution. Do not manually release while distribution is still public.
- App Privacy answers, content rights, legal entity/copyright, Digital Services
  Act trader status, agreements, tax/banking, review contact, and review
  credentials require the authorized owner. Engineering evidence cannot attest
  for that person.
- App transfer later: both Account Holders participate; TestFlight must be
  cleaned up and Apple’s current criteria satisfied. The app cannot transfer
  until at least one version has been released on the App Store. Back up the
  App Store record and coordinate bundle/keychain/signing implications first.

## Monitoring and support

- Support mailbox: `info@capturethis.com` (**OWNER APPROVAL AND NAMED OWNER**)
- Check Vercel runtime errors and availability before a shoot and during review.
- No crash-reporting SDK is recorded in Build 13. Record device/iOS/app build,
  printer firmware, stock, last successful step, and sanitized error copy for
  incidents.
- Never log or screenshot a production token. Revoke it if exposed.
- Review Supabase database health/storage, authentication events, and backup
  status on an agreed schedule.

## Operational ownership and independence

Fill every blank with a person and a backup. The product builder is not an implied default.
If the product builder is providing support after acceptance, record its scope, hours,
duration, response target, and whether it is paid. Otherwise record **none**.

| Responsibility | Primary owner | Backup | Evidence before handoff |
|---|---|---|---|
| Printer, charger/cable, asset record | **OWNER INPUT** | **OWNER INPUT** | Inventory signed |
| Ribbon and replacement ribbon | **OWNER INPUT** | **OWNER INPUT** | Part/reorder source recorded |
| Label stock and replacement stock | **OWNER INPUT** | **OWNER INPUT** | Dimensions/shape/part/reorder source recorded |
| Day-of printer operation and recovery | Intended operator / confirm | **OWNER INPUT** | Intended-operator physical pilot passed |
| Post-handoff physical regression testing | **OWNER INPUT** | **OWNER INPUT** | Intended-operator test arrangement or second M2_H recorded |
| Issue/reissue runner links | **OWNER INPUT** | **OWNER INPUT** | Individual operator account tested |
| Revoke runner links | **OWNER INPUT** | **OWNER INPUT** | Dashboard role and denied-old-link test |
| Draft/publish/default/assign label templates | **OWNER INPUT** | **OWNER INPUT** | Grid 01 baseline plus published-version audit tested |
| Review and complete production closeout | **OWNER INPUT** | **OWNER INPUT** | Blocked and successful fictional closeout demonstrated |
| Invite/remove signed-in web operators | **OWNER INPUT** | **OWNER INPUT** | Supabase role tested |
| Production incident lead | **OWNER INPUT** | **OWNER INPUT** | Contact tree and severity path recorded |
| Support mailbox response | **OWNER INPUT** | **OWNER INPUT** | Individual mailbox roles tested |
| Produce and sign a replacement iOS build | **OWNER INPUT** | **OWNER INPUT** | Clean-machine/documented build drill |
| Upload/manage TestFlight builds and groups | **OWNER INPUT** | **OWNER INPUT** | App Store Connect role tested |
| Maintain permanent unlisted App Store release | **OWNER INPUT** | **OWNER INPUT** | Direct install link verified |
| App Privacy, DSA, agreements, and legal attestations | **OWNER INPUT** | **OWNER INPUT** | Authorized App Store Connect submission recorded |
| Database backups and restore drills | **OWNER INPUT** | **OWNER INPUT** | Policy plus latest restore evidence |
| Product-builder post-handoff support | **NONE OR WRITTEN SCOPE** | n/a | Boundary signed below |

The intended operator owns routine day-of operation only after their physical acceptance passes.
The named account owners retain hosting, database, Apple, billing, backup, and
security obligations. Do not hand those obligations to the intended operator merely by providing
a shared password.

## Accounts, renewals, and recurring costs

| Service | Legal/account owner | Billing owner | Renewal/date | Current plan/cost | Backup admin |
|---|---|---|---|---|---|
| GitHub | **OWNER INPUT** | **OWNER INPUT** | **OWNER INPUT** | **OWNER INPUT** | **OWNER INPUT** |
| Vercel | **OWNER INPUT** | **OWNER INPUT** | **OWNER INPUT** | **OWNER INPUT** | **OWNER INPUT** |
| Supabase | **OWNER INPUT** | **OWNER INPUT** | **OWNER INPUT** | **OWNER INPUT** | **OWNER INPUT** |
| `capturethis.com` registrar/DNS | **OWNER INPUT** | **OWNER INPUT** | **OWNER INPUT** | **OWNER INPUT** | **OWNER INPUT** |
| Apple Developer Program | **OWNER INPUT** | **OWNER INPUT** | **OWNER INPUT** | Confirm current Apple invoice | **OWNER INPUT** |
| Support mailbox | **OWNER INPUT** | **OWNER INPUT** | **OWNER INPUT** | **OWNER INPUT** | **OWNER INPUT** |

Enable renewal/billing alerts to at least two people. A buddy who only operates
productions should receive an invited operator/App Store tester role, not domain,
database, Apple, or GitHub ownership and never a shared account password.

Record these service-specific authorities as well:

- Apple Developer/App Store Connect Account Holder: **OWNER INPUT**
- TestFlight group/build-renewal operator: **OWNER INPUT**
- Permanent unlisted-distribution release operator: **OWNER INPUT**
- GitHub repository admin: **OWNER INPUT**
- Vercel project admin and production deployer: **OWNER INPUT**
- Supabase organization/project admin: **OWNER INPUT**
- Domain registrar and DNS admin: **OWNER INPUT**
- Billing/renewal escalation owner across all services: **OWNER INPUT**

## Distribution and replacement-device plan

TestFlight is a pilot channel, not permanent delivery. A TestFlight build
expires 90 days after upload; invitations, groups, and replacement uploads
require an authorized App Store Connect user. A phone replacement cannot rely
on an expired build, and a locally installed/archive-only app is not a handoff
distribution plan.

The durable target is an Apple-approved **unlisted App Store** version with a
verified direct install link. It is not searchable, but an authorized crew
member can reinstall it on a replacement iPhone without the product builder making a local
build. The Apple Account Holder still owns agreements and membership; at least
two named people should be able to prepare, sign, upload, and release a
replacement build using individual roles.

Before the permanent link exists, a minimum pilot handoff requires:

- The exact tested TestFlight build installed on the intended operator's phone.
- Its expiry date and renewal owner recorded.
- The signed source commit, IPA/archive evidence, and next unused build number
  recorded.
- A second authorized release operator who can replace the build without
  the product builder, plus a tested fallback `/labels` path.

Permanent independence requires the approved unlisted direct link, a clean-phone
reinstall test, individual Apple roles for primary and backup release operators,
documented signing/build steps, an accepted support boundary, and continuing
access to an M2_H for replacement-build regression tests. Record whether the intended operator
will run those tests by arrangement or an account owner will keep a second
compatible printer.

## Handoff acceptance gate

The handoff does not pass because automated tests pass. The intended operator must personally,
without the product builder operating the phone or dashboard:

- [ ] Install/open the supported app from the documented distribution path.
- [ ] Sign in with the individual fictional account and select the existing
      fictional Active day.
- [ ] Connect the exact accepted M2_H.
- [ ] Print short and long labels sequentially, one at a time, and confirm the
      shipping deck exposes only the individual action.
- [ ] Confirm the assigned/default template preview matches the physical output
      and Grid 01 remains available as the accepted fallback.
- [ ] Verify successful `label_printed` synchronization on the hosted web app.
- [ ] Recover an interrupted/uncertain print without an accidental duplicate.
- [ ] Power-cycle/reconnect and background/resume successfully.
- [ ] Reconcile Summary, share a fictional summary, prove premature closeout is
      rejected, then complete a fully resolved fictional day.
- [ ] Export and print one `/labels` fallback asset.
- [ ] Identify whom to contact and provide only sanitized incident evidence.

Complete
[the Build 13 physical acceptance worksheet](build-13-physical-acceptance-worksheet-2026-07-30.md)
during the same session.

## Final inventory and sign-off

| Item | Identifying/reorder information | Received/accepted |
|---|---|---|
| M2_H printer | Asset/serial: _____ | _____ |
| Charger/cable | _____ | _____ |
| Ribbon installed | Type/color/brand/lot/condition: _____ | _____ |
| Spare ribbon | Part/quantity/condition: _____ | _____ |
| Ribbon reorder source | Supplier/listing/SKU/purchaser: _____ | _____ |
| Label stock installed | Brand/type/finish/lot/feed: _____ | _____ |
| Label stock dimensions | Measured width × height: _____ | _____ |
| Spare stock | Part/quantity/roll count: _____ | _____ |
| Stock reorder source | Supplier/listing/SKU/purchaser: _____ | _____ |
| Firmware record | Version only; no update: _____ | _____ |
| Supported Capture This app | Version/build/install path: _____ | _____ |
| TestFlight lifecycle | Exact expiration/renewal owner: _____ | _____ |
| Operator Quick Start | Revision/date: _____ | _____ |
| `/labels` fallback guide | Web account confirmed: _____ | _____ |
| Account invitations | Services/roles: _____ | _____ |
| Open limitation | One-label-at-a-time support acknowledged: _____ | _____ |
| Template baseline | Assigned/default version and Grid 01 fallback: _____ | _____ |
| Closeout drill | Premature rejection and permanent completion: _____ | _____ |
| Support boundary | Contact/hours/term/response target/scope: _____ | _____ |
| Evidence photos | Fictional short/long/cold-cup paths: _____ | _____ |
| Packing/shipping | Packing accepted/carrier/tracking/recipient: _____ | _____ |

- Intended-operator acceptance — name/signature/date: _____
- Physical asset owner — name/signature/date: _____
- Platform/account owner — name/signature/date: _____
- Product-builder support boundary accepted — name/signature/date: _____
- **Printer may leave the product builder's possession: yes/no** _____

## Post-test token, access, and data cleanup

The named Supabase/token owner completes this after evidence is captured:

1. Revoke every disposable acceptance link by setting its token row's
   `revoked_at` timestamp. Never paste the raw token into SQL, tickets, or chat;
   identify the row by the fictional production and recorded creation time.
2. Open the old URL in a private browser and record only the denied status—not
   the URL or token.
3. Keep the fictional App Review fixture only while Apple or the external pilot
   still needs it. Revoke its share rows and remove access after the final review,
   or document the reason and owner for retaining it.
4. Remove testers, operators, and account roles that are no longer necessary.
5. Remove token-bearing screenshots, clipboard notes, local logs, broad emails,
   chat messages, and untracked evidence copies.
6. Confirm release screenshots and physical photos use fictional data only and
   contain no client data or visible token.
7. Rotate the previously identified temporary credential class and record only
   the rotation date and responsible owner, never the value.
