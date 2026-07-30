# Capture This documentation

This index separates current operating material from dated implementation and
decision records. Start with the smallest document that answers the question;
the root [README](../README.md) is the project overview.

## Start here

| Document | Use it for |
| --- | --- |
| [Current state](current-state-2026-07-30.md) | Active Build 13 candidate, verified capabilities, limitations, release state, and external gates |
| [Mobile app guide](../mobile/README.md) | iOS architecture, local setup, signing, printing, and recovery |
| [Handoff hub](HANDOFF.md) | Role-based handoff packet and definition of done |
| [App experience map](app-experience-map.md) | Product surfaces and how they connect |

The dated Build 10 state record remains historical evidence; Build 13 has its
own current-state record.

## Operate and support

| Document | Use it for |
| --- | --- |
| [Standard operating procedure](standard-operating-procedure.md) | Prepare, run, print, recover, and close a shoot day |
| [Operator quick start](operator-quick-start.md) | Short day-of printer workflow |
| [Client login handoff](client-login-handoff.md) | Provision operator access safely |
| [Fallback label export](label-image-export.md) | Export and print when direct BLE is unavailable |
| [Operational handoff](operational-handoff.md) | Ownership, inventory, support, billing, and continuity |

## Release and validation

| Document | Use it for |
| --- | --- |
| [Build 13 launch](build-13-app-store-launch-2026-07-30.md) | Current implementation, verification, deployment, App Review, unlisted-release, and blocker ledger |
| [Build 13 physical worksheet](build-13-physical-acceptance-worksheet-2026-07-30.md) | Exact Build 13 device, printer, stock, template, recovery, and independent-operator gate |
| [Build 13 App Review packet](build-13-app-review-unlisted-packet-2026-07-30.md) | Current metadata, review notes, screenshot set, fictional review path, and unlisted sequence |
| [Build 13 App Privacy](build-13-app-privacy-2026-07-30.md) | Current source-manifest and App Privacy evidence |
| [Build 13 database migration](build-13-database-migration-and-rollback.md) | Additive schema, verification, rollout, and forward-rollback procedure |
| [Template authoring](label-template-authoring-and-publishing.md) | Declarative schema, publishing, assignment, compatibility, and safety limits |
| [App Store installation](app-store-installation-and-replacement-builds.md) | Unlisted installation and replacement-build procedure |
| [Build 11 readiness](build-11-release-readiness-2026-07-27.md) | Historical Build 11 source review and unresolved release gates |
| [Build 11 physical worksheet](build-11-physical-release-worksheet-2026-07-27.md) | Historical blank/incomplete exact-build physical worksheet |
| [Build 11 external review packet](build-11-external-review-packet-2026-07-27.md) | Historical Build 11 review copy and private-input gaps |
| [Build 11 privacy review](app-store-privacy-build-11-2026-07-27.md) | Historical Build 11 App Privacy reconciliation |
| [Build 10 pilot and hardware handoff](build-10-pilot-handoff-2026-07-27.md) | Historical Build 10 handoff and unresolved physical evidence |
| [Build 10 validation](build-10-release-validation-2026-07-25.md) | Historical detailed acceptance record |
| [Physical release test](physical-release-test.md) | Historical Build 9/10 physical record; do not convert blanks into Build 11 passes |
| [Build 13 release evidence](release-evidence-1.0.0-build-13.md) | Build 13 source, build, deployment, Apple, and physical evidence |
| [Historical 1.0.0 evidence](release-evidence-1.0.0.md) | Earlier source, build, deployment, and physical evidence |
| [TestFlight checklist](testflight-checklist.md) | Internal and external beta distribution |
| [Build 10 TestFlight metadata](build-10-external-testflight-metadata-2026-07-27.md) | Historical owner-approved Build 10 beta copy; Build 10 is internal evidence only |
| [Historical Build 6 App Store dossier](app-store-release.md) | Prior metadata evidence; not current submission copy |
| [Production readiness](production-readiness-checklist.md) | Full technical and operational audit |
| [Review fixture](review-production-fixture.md) | Fictional App Review data |

## Product direction and architecture

| Document | Use it for |
| --- | --- |
| [App-first direction](app-first-direction-2026-07-25.md) | Current product boundary between iOS and web |
| [Complete iOS plan](ios-complete-product-plan-2026-07-25.md) | Build sequence for the full operating loop |
| [Build 10 implementation](build-10-implementation-2026-07-25.md) | Offline collection and sync design |
| [Phone printing investigation](phone-printing-investigation.md) | Hardware and integration decision record |
| [Scannable-code spike](spike/README.md) | Experimental QR/Data Matrix work |

## Historical records

These files explain earlier decisions or preserve presentation/release history.
They are not the current source of truth:

- `client-presentation-2026-07-06.md`
- `client-roadmap-vercel-deploys-2026-07-06.md` and its HTML export
- `codex-handoff-2026-07-02.md`
- `direction-update-2026-07-24.md`
- `offline-first-ios-handoff.md`
- `ui-rework-build-8.md`
- `niimbot-m2-plan.md`
- `llm-improvement-brief.md`
- `operator-update-2026-07.md` and its PDF export
- [`milestones/`](milestones/)

Historical files remain in place so links and release evidence do not break.
When current behavior and a dated record disagree, follow
[Current state](current-state-2026-07-30.md).
