# Capture This release and operations handoff

Last updated: 2026-07-15

This handoff grants roles, not shared passwords. Fill the ownership and renewal
register with the account holders before final release.

## Source and release

- GitHub: `https://github.com/coltonbatts/capturethiscoffee`
- Production branch: `main`
- Release work branch: `codex/release-1.0.0`
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
flutter build ipa --release
```

Increase the `version:` build suffix in `mobile/pubspec.yaml` for every upload.
Increase the marketing version only for a new App Store version. Preserve the
exact `niim_blue_flutter: 1.0.1` pin unless an M2_H regression plan and physical
printer are available.

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

## Supabase operations

- Project owner/organization: **OWNER REGISTER**
- Apply `supabase/schema.sql` for a fresh project and all files in
  `supabase/migrations/` in filename order. Record each applied migration.
- Confirm `orders` is present in the `supabase_realtime` publication.
- Keep public email sign-ups disabled. Invite operators deliberately; current
  signed-in operators share full workspace access. The 2026-07-15 release audit
  found public signup enabled, so the owner must disable and re-verify it before
  release.
- Confirm RLS denies anonymous direct access to core tables. The service-role
  key stays server-side and should be rotated after suspected exposure.
- Production links are generated from the production UI. Treat them as bearer
  credentials: send privately, revoke from the production UI/database when no
  longer needed, and replace compromised links.
- Backup policy: **OWNER MUST CONFIGURE/RECORD** the Supabase plan, PITR or daily
  backup capability, retention window, last restore drill, and responsible
  person. Before destructive migrations, take/export a verified backup. Test a
  restore to a non-production environment at least quarterly.
- Recovery priority: restore database authority first, then redeploy the known
  matching web commit, verify RLS and token behavior, and rotate exposed tokens.

## Day-of production

1. A signed-in operator creates the client/production, fictional test order,
   roster, and runner link.
2. Confirm the production is active and test the link in a private browser.
3. The printer operator installs Capture This, links the URL, force-quits the
   official NIIMBOT app, and powers off other nearby NIIMBOT printers.
4. Connect only the physically verified M2_H. Do not update printer firmware.
5. If a print succeeds but sync fails, do not tap Print again. Use **Sync only**.
   If the outcome is uncertain, inspect the printer/physical label and choose
   **Label printed — sync only** or **Nothing printed — retry**.
6. Keep the authenticated `/labels` PNG/CSV flow as the fallback.

## Apple operations

- Apple Developer/App Store Connect Account Holder: **OWNER REGISTER**
- Team ID: recorded in the Xcode project; do not share signing credentials.
- Bundle ID: `com.capturethis.ctcprinter`
- Minimum roles: give a release operator only the App Manager or Developer role
  needed for their work; the Account Holder retains agreements, membership,
  transfers, and legal authority.
- Invite internal users under Users and Access. Invite the buddy by email to a
  named external TestFlight group after Beta App Review approval.
- Upload each unique build through Xcode/Transporter. Record processing status,
  export-compliance response, group, feedback, fixes, and replacement build.
- For an update: bump build/version, run all checks, repeat affected physical
  tests, upload, pilot externally, update metadata/privacy answers, submit, and
  preserve manual release control.
- App transfer later: both Account Holders participate; TestFlight must be
  cleaned up and Apple’s current criteria satisfied. The app cannot transfer
  until at least one version has been released on the App Store. Back up the
  App Store record and coordinate bundle/keychain/signing implications first.

## Monitoring and support

- Support: `info@capturethis.com` (**OWNER APPROVAL**)
- Check Vercel runtime errors and availability before a shoot and during review.
- No crash-reporting SDK is in build 5. Record device/iOS/app build, printer
  firmware, stock, last successful step, and sanitized error copy for incidents.
- Never log or screenshot a production token. Revoke it if exposed.
- Review Supabase database health/storage, authentication events, and backup
  status on an agreed schedule.

## Ownership, renewals, and recurring costs

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
