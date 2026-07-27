# Capture This Coffee documentation

This index separates current operating material from dated implementation and
decision records. Start with the smallest document that answers the question;
the root [README](../README.md) is the project overview.

## Start here

| Document | Use it for |
| --- | --- |
| [Current state](current-state-2026-07-25.md) | Active build, verified capabilities, limitations, and next work |
| [Mobile app guide](../mobile/README.md) | iOS architecture, local setup, signing, printing, and recovery |
| [Handoff hub](HANDOFF.md) | Role-based handoff packet and definition of done |
| [App experience map](app-experience-map.md) | Product surfaces and how they connect |

The current-state filename records when the Build 10 plan began; the document
itself is maintained and carries its own last-updated date.

## Operate and support

| Document | Use it for |
| --- | --- |
| [Standard operating procedure](standard-operating-procedure.md) | Prepare, run, print, recover, and close a shoot day |
| [Operator quick start](luke-quick-start.md) | Short day-of printer workflow |
| [Client login handoff](client-login-handoff.md) | Provision operator access safely |
| [Fallback label export](label-image-export.md) | Export and print when direct BLE is unavailable |
| [Operational handoff](operational-handoff.md) | Ownership, inventory, support, billing, and continuity |

## Release and validation

| Document | Use it for |
| --- | --- |
| [Physical release test](physical-release-test.md) | Required device, printer, stock, and recovery acceptance |
| [Build 10 validation](build-10-release-validation-2026-07-25.md) | Current detailed acceptance record |
| [Release evidence](release-evidence-1.0.0.md) | Source, build, deployment, and physical evidence |
| [TestFlight checklist](testflight-checklist.md) | Internal and external beta distribution |
| [App Store release](app-store-release.md) | Permanent distribution dossier |
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
- `luke-update-2026-07.md` and its PDF export
- [`milestones/`](milestones/)

Historical files remain in place so links and release evidence do not break.
When current behavior and a dated record disagree, follow
[Current state](current-state-2026-07-25.md).
