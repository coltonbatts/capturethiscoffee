# Capture This current state — Build 13

Date: 2026-07-30
Release candidate: `1.0.0 (13)`
Branch: `codex/build-13-app-store-launch`

This is the current-state index for Build 13. It records facts without turning
software evidence into physical or Apple approval.

## Product state

Build 12, `1.0.0 (12)`, is the latest processed internal TestFlight build. Its
implementation, production migration, web deployment, signed artifact, and
internal assignment are recorded in
[`build-12-native-setup-2026-07-29.md`](build-12-native-setup-2026-07-29.md).

Build 13 is the next release candidate. It preserves invited-account access,
offline Collect/Print, conditional replay, conflict handling, monotonic printed
facts, uncertain-print recovery, one-label-at-a-time M2_H output, and the
authenticated `/labels` fallback. It adds:

- one canonical version-1 declarative catalog for the eight existing
  591×354 label designs;
- authenticated drafts, immutable published versions, a default for future
  days, and Planning-only per-day assignment;
- a frozen template snapshot once a day becomes Active;
- matching bounded web and Flutter interpreters with no remote executable code;
- last-known-good template caching and bundled Grid 01 fallback;
- native grouped and by-person summaries, iOS sharing, and guarded,
  server-authoritative Active-to-Complete closeout; and
- current privacy, support, review, installation, replacement-build, operator,
  and physical-acceptance material.

## Release state

The detailed Build 13 ledger is
[`build-13-app-store-launch-2026-07-30.md`](build-13-app-store-launch-2026-07-30.md).
Until that record contains actual successful evidence:

- the implementation is not represented as merged;
- the Build 13 migration is not represented as applied to production;
- the Build 13 web source is not represented as deployed;
- no Build 13 signed binary, upload, processing, internal assignment, or
  installation is represented as complete;
- no Build 13 physical test is represented as passed;
- App Review and unlisted distribution are represented as pending; and
- no public searchable App Store or public TestFlight release is authorized.

## Operating boundary

The physical authority remains the exact supported NIIMBOT M2_H, 50×30 mm
rectangular stock, density 3, and exact `niim_blue_flutter: 1.0.1` dependency.
Operators print one label, inspect it, and resolve its sync/recovery state before
starting another. No unattended or batch-print claim is supported.

A web or native operator prepares the Planning day and roster. A web operator
may choose a published template before activation. After activation, the app
collects orders, previews and prints the snapshotted design locally, and
continues from a valid cached day/template offline. Closeout requires a current
connection and server confirmation after every on-set order and print state is
resolved.

## Open external gates

- Complete the
  [Build 13 physical worksheet](build-13-physical-acceptance-worksheet-2026-07-30.md)
  on the exact final binary, phone, printer, firmware, ribbon, and stock.
- Supply/verify the private persistent fictional reviewer account and review
  fixture without committing credentials.
- Have the authorized owner complete App Privacy/provider attestations,
  content rights, legal entity/copyright, reviewer contact, Digital Services
  Act trader status, agreements, and any tax/banking requirements.
- Submit and obtain App Review acceptance.
- Obtain Apple's unlisted-distribution approval before manual release.
- Verify the resulting direct link, clean-phone installation, and sign-in.

The operator and ownership path starts at [`HANDOFF.md`](HANDOFF.md). Build 13
review metadata and release sequencing are in
[`build-13-app-review-unlisted-packet-2026-07-30.md`](build-13-app-review-unlisted-packet-2026-07-30.md).
