# App Store screenshot assets

The nine English (U.S.) PNGs in `iphone-6.9/` are truthful Build 13
release-candidate screens generated from the shipping Flutter UI at an
Apple-accepted 6.9-inch portrait size of 1320×2868 pixels.

| File | Current release-candidate screen |
|---|---|
| `01-invited-account-sign-in.png` | Blank invited-account sign-in; no credentials entered |
| `02-existing-days.png` | Existing Active, Planning, and Complete day selection |
| `03-collect-orders.png` | Order collection and editing |
| `04-individual-print-deck.png` | Cached individual-print deck and real local label preview; printer visibly disconnected |
| `05-offline-conflict.png` | Offline pending mutation and visible conflict protection |
| `06-duplicate-safe-recovery.png` | Uncertain single-label recovery choices that prevent duplicate printing |
| `07-about-release.png` | About, privacy/support links, and `1.0.0 (13)` identity |
| `08-summary-closeout.png` | Grouped shop order, by-person Printed/No drink states, native share control, and guarded closeout |
| `09-template-test-label.png` | Current published template name/version/status and the fictional no-facts test-label action |

Every name, company, day, order, user ID, and email domain in the fixture is
fictional. The fixture performs no network request. The assets show no password,
token, production identifier, notification, real crew information, or claimed
physical print. The disconnected and offline states are intentional: no
connected M2_H or successful paper output was fabricated.

The source goldens are under `mobile/test/goldens/app-store/`. The test harness
loads the bundled Geist, Geist Mono, Arial, and Material Icons fonts so Flutter's
test-only block font cannot leak into the images. It asserts the output is
exactly 1320×2868. The committed App Store copies are then flattened to RGB.

Flutter's rasterizer can move a handful of antialiasing pixels between the
release Mac and GitHub's macOS 15 runner even with the same Flutter version and
bundled fonts. The App Store golden comparator therefore permits at most
`0.01%` differing pixels (about 379 of 3,785,760) while dimensions remain
exact. This is narrow enough that a one-pixel full-width line, shifted layout,
or changed copy still fails. Release assets still require exact regeneration
on the release Mac plus human visual inspection; CI tolerance is not permission
to replace or approve store assets automatically.

Regenerate and verify:

```bash
cd mobile
flutter test test/app_store_screenshot_test.dart --update-goldens
flutter test test/app_store_screenshot_test.dart
cp test/goldens/app-store/*.png \
  ../docs/app-store-assets/iphone-6.9/
dart run tool/flatten_app_store_png.dart \
  ../docs/app-store-assets/iphone-6.9/*.png
file ../docs/app-store-assets/iphone-6.9/*.png
sips -g pixelWidth -g pixelHeight -g hasAlpha \
  ../docs/app-store-assets/iphone-6.9/*.png
```

The final nine files were visually inspected on 2026-07-30 after generation.
Each is 1320×2868, 8-bit RGB, non-interlaced, with no alpha channel.

Immediately before App Store Connect upload, rerun the harness, visually inspect
every file, and reconfirm fictional data, accurate release identity, dimensions,
and alpha status. A real printer photo or video is optional and may be added
only from a directly observed physical session using fictional data.
