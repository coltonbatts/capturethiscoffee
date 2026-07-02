# TestFlight checklist — CTC Printer

Track progress here. Internal testing skips beta review; external testers (e.g. Luke) need beta review + privacy policy URL.

## Status

| Step | Owner | Done |
|---|---|---|
| Version `0.1.0+1` in `pubspec.yaml` | Agent | ✅ |
| Export compliance key in `Info.plist` | Agent | ✅ |
| Release IPA builds | | ☐ |
| Bundle ID registered in Apple Developer | You | ✅ |
| App record in App Store Connect | You | ✅ |
| CTC web app deployed on HTTPS | You | ☐ |
| One end-to-end print on production API | You | ☐ |
| IPA uploaded to App Store Connect | You | ✅ |
| Build processing complete (Ready to Submit) | You | ✅ |
| Internal TestFlight (your phone) | You | ✅ |
| External testers invited | You | ☐ |

---

## Phase 1 — Apple Developer (one-time, ~30 min)

### 1A. Confirm bundle ID

1. Open [developer.apple.com/account](https://developer.apple.com/account) → **Certificates, Identifiers & Profiles** → **Identifiers**.
2. Look for `com.capturethis.ctcprinter`.
3. If missing: **+** → **App IDs** → **App** → Description: `CTC Printer` → Bundle ID: **Explicit** `com.capturethis.ctcprinter` → enable nothing extra unless prompted → Register.

### 1B. Create App Store Connect record

1. Open [appstoreconnect.apple.com](https://appstoreconnect.apple.com) → **Apps** → **+** → **New App**.
2. Fill in:
   - **Platforms:** iOS
   - **Name:** `CTC Printer` (App Store display name; can change later)
   - **Primary language:** English (U.S.)
   - **Bundle ID:** `com.capturethis.ctcprinter`
   - **SKU:** `ctc-printer` (any unique string; never shown to users)
   - **User Access:** Full Access
3. Click **Create**. You do not need screenshots or description for TestFlight-only.

**Tell the agent when this step is done** so we can upload.

---

## Phase 2 — Backend ready for testers

TestFlight builds cannot use `http://192.168.x.x:3000`. Testers need a **deployed HTTPS** CTC instance.

1. Confirm production has `SUPABASE_SERVICE_ROLE_KEY` set.
2. Confirm label API routes work:
   - `GET /api/public/productions/{id}/labels?token=…`
   - `GET /api/public/orders/{id}/label?productionId=…&token=…`
3. Production status must be **active** before `label_printed` PATCH works.
4. Generate a real share link and test on your phone before inviting others.

---

## Phase 3 — Build Release IPA

From repo root:

```bash
cd mobile
flutter pub get
flutter analyze
flutter test
flutter build ipa --release
```

Output: `mobile/build/ios/ipa/ctc_printer.ipa`

If `flutter build ipa` fails on signing, open Xcode:

```bash
open ios/Runner.xcworkspace
```

Runner target → **Signing & Capabilities** → Team: your paid account → **Automatically manage signing** → Bundle ID `com.capturethis.ctcprinter`. Then retry `flutter build ipa`.

---

## Phase 4 — Upload

### Option A — Xcode (recommended first time)

```bash
open ios/Runner.xcworkspace
```

1. Select **Any iOS Device (arm64)** as destination (not a simulator).
2. **Product → Archive** (wait for build).
3. **Organizer** opens → select archive → **Distribute App**.
4. **App Store Connect** → **Upload** → defaults OK → Upload.
5. Wait for email: “App Store Connect: Your build has completed processing” (5–30 min).

### Option B — Transporter app

1. Install **Transporter** from Mac App Store.
2. Drag `mobile/build/ios/ipa/ctc_printer.ipa` into Transporter → **Deliver**.

---

## Phase 5 — TestFlight configuration

In App Store Connect → **CTC Printer** → **TestFlight**:

### Build metadata

1. Click the new build (e.g. `0.1.0 (1)`).
2. **Export Compliance** — should auto-skip if `ITSAppUsesNonExemptEncryption` is false in Info.plist. If asked: uses encryption (HTTPS only), exempt.

### App Privacy (required)

**App Privacy** in the left sidebar → **Get Started**:

- **Data collected:** minimal honest answers
  - No account created in app
  - **Identifiers:** production share token (not linked to user identity if you treat it as operational)
  - **Other data:** crew names / drink orders fetched from your server for printing
- Purpose: app functionality only
- Not used for tracking

Adjust to match your actual deployment; this is not legal advice.

### Internal testing (you, same day)

1. **TestFlight** → **Internal Testing** → default **App Store Connect Users** group.
2. Add yourself if not already there.
3. Enable the build for the group.
4. On iPhone: install **TestFlight** app → accept invite → install **CTC Printer**.

### External testing (Luke / crew, not on your team)

1. **External Testing** → **+** → create group (e.g. `On-set crew`).
2. Add tester emails.
3. Fill **Beta App Description** (example):

   > CTC Printer connects to a NIIMBOT M2_H label printer over Bluetooth and prints cup labels from a Capture This Coffee production share link. Requires a valid production URL from the CTC web app.

4. **Privacy Policy URL** — required. A simple page on your site is enough (even `https://yoursite.com/privacy` with a short paragraph).
5. Submit for **Beta App Review** (first external build only; often 24–48 hours).

---

## Phase 6 — On-set smoke test

1. Force-quit official NIIMBOT app.
2. Open production share link on phone (HTTPS).
3. CTC Printer → paste URL → Link production.
4. Connect printer → Print one label.
5. Confirm `label_printed` on runner board / Supabase.

---

## Ongoing

- Bump build number for every upload: `0.1.0+2`, `0.1.0+3`, … in `pubspec.yaml`.
- TestFlight builds **expire after 90 days** — upload a fresh build quarterly.
- BLE printing still requires a **physical iPhone**; Simulator cannot test printer.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| Upload fails “No suitable application records” | Finish Phase 1B — create App Store Connect app with matching bundle ID |
| “Invalid Provisioning Profile” | Xcode → Signing → Automatic + correct team |
| Archive greyed out | Select **Any iOS Device**, not Simulator |
| TestFlight install but API fails | Share URL must be HTTPS production, not localhost/LAN |
| Mark printed fails | Production must be **active** |
| Connect printer fails | Force-quit NIIMBOT app; check Bluetooth permission |
