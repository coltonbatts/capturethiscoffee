# Contributing

Capture This Coffee is maintained as a client product, not a general-purpose
open-source package. Keep changes focused, reviewable, and tied to an operating
need.

## Before making a change

1. Read the root [README](../README.md) and
   [current-state document](../docs/current-state-2026-07-25.md).
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

Run the checks for every surface you touch.

Web:

```bash
npm ci
npm run lint
npm run test
npm run build
```

Mobile:

```bash
cd mobile
flutter pub get
flutter analyze
flutter test
```

Label rendering or printer work may also require:

```bash
npm run verify:niimbot-export
node scripts/compare-label-renderers.mjs
```

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
