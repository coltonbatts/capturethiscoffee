# App Store screenshot assets

The `iphone-6.9/` PNGs are provisional English (U.S.) App Store screenshots
captured from the iPhone 17 Pro Max simulator at an accepted 6.9-inch portrait
size of 1320×2868 pixels.

| File | Screen | Data source |
|---|---|---|
| `01-link-production.png` | Unlinked production entry screen | Actual release UI, no token entered |
| `02-pending-queue.png` | Fictional pending label queue | Non-shipping `mobile/tool/app_store_screenshot.dart` fixture |
| `03-print-sync-recovery.png` | Duplicate-safe sync/uncertain recovery summary | Same non-shipping fictional fixture |

The source images have no alpha channel or transparency. They contain no live
production identifiers, share token, crew data, notifications, or account
information. The fixture is compiled only when its `tool/` entry point is
selected; the release archive continues to use `mobile/lib/main.dart`.

Regenerate on the 6.9-inch simulator, then remove alpha:

```bash
cd mobile
flutter build ios --simulator --debug \
  -t tool/app_store_screenshot.dart \
  --dart-define=APP_STORE_SCREEN=queue
dart run tool/flatten_app_store_png.dart \
  ../docs/app-store-assets/iphone-6.9/02-pending-queue.png
```

Before submission, consider adding a screenshot or short video from the exact
physically tested M2_H flow. Never fake the connected state. Recheck every
final asset for dimensions, alpha, fictional data, accurate version UI, and
absence of tokens immediately before upload.
