# Contributing

Capture This Coffee is maintained as a client product, not a general-purpose
open-source package. Keep changes focused, reviewable, and tied to an operating
need.

## Before making a change

1. Start with [AGENTS.md](../AGENTS.md); use the
   [documentation index](../docs/README.md) to select relevant context.
2. Check existing issues and pull requests before opening duplicate work.
3. Use a short branch name such as `feature/order-summary` or
   `fix/offline-sync`.
4. Use fictional productions, people, drinks, screenshots, and test records.

## Product boundaries

- `mobile/` is the primary product surface.
- `src/` is a maintained fallback for setup, the zero-install runner, and label
  export. Security, compatibility, and fallback reliability changes are
  welcome; new web-only product features need an explicit product decision.
- Supabase is the authoritative shared data store.
- `niim_blue_flutter` is pinned deliberately. Do not update it or printer
  firmware as incidental dependency maintenance.
- A passing build does not verify Bluetooth behavior, print quality, or
  duplicate-safe recovery. Printer changes require the documented physical
  gate.

## Verification

Local checks should match the affected behavior and risk. Reuse usable dependencies;
install only when missing or changed. Do not repeat passing checks without a
relevant edit or unresolved concern.

| Change | Local verification |
| --- | --- |
| Documentation | Review diff, links, referenced paths, and `git diff --check`; no app build required |
| Cosmetic/UI | Focused widget or UI checks and affected visual comparisons; preserve physical-label baselines |
| Authentication, database, offline replay, printing, recovery | Meaningful regression coverage across affected boundaries plus applicable integration checks; a cosmetic check alone is insufficient |

Web tests can be selected from the root with
`node --import tsx --test tests/production-share.test.ts` (choose the affected
file). Use `npm run lint`, `npm run test`, and `npm run build` when the change
warrants broader web verification. For Flutter, run from `mobile/`, for example
`flutter test --no-pub test/print_recovery_test.dart`; select the related outbox,
authenticated-flow, offline, and transport tests when those boundaries change.
Use `flutter analyze --no-pub` and broader suites as warranted.

Label changes also use `npm run verify:niimbot-export` from the root and the
[mobile golden/comparison workflow](../mobile/README.md#visual-regression-and-renderer-comparison).
Compare existing goldens before any update; inspect failures, then update only
specific intentionally changed baselines. Keep failure diagnostics for review.

These local choices do not replace [CI](workflows/quality.yml): web lint/tests/
build/export checks, mobile non-golden tests and analysis, and the macOS App Store
screenshot check. Physical-label goldens remain an exact local/release check on
the accepted build machine; host differences are not permission to overwrite them.
For database and release work, locate the applicable migration procedure and
exact-candidate evidence through the [index](../docs/README.md#release-and-validation).
Printer changes retain recovery/offline regressions and the physical acceptance
gate; software checks cannot establish usable paper, radio behavior, installation,
or release approval. Report any gate that still requires external action.

## Pull requests

- Explain the operating problem and the resulting behavior.
- Keep generated files and unrelated formatting out of the diff.
- Call out schema migrations, environment changes, release implications, and
  physical verification still needed.
- Update the smallest current document that owns the changed behavior.
- Do not put credentials, share tokens, signing assets, private crew data, or
  identifiable client data in commits, screenshots, logs, issues, or PRs.

By contributing, you acknowledge that no public license is granted for this
client project.
