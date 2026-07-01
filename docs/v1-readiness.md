# Capture This Coffee V1 readiness

## Setup checklist

- Deploy the app with `NEXT_PUBLIC_ENABLE_AUTH` unset or `true`.
- Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- Confirm `/login` signs in the client user and redirects to `/productions`.
- Create the real client, production, runner name, shoot date, and location.
- Add or import the day-of people before the shoot when possible.
- On a phone, open the production page and verify search, quick add, order edit,
  and status taps are comfortable one-handed.
- On a phone, open `/labels`, preview a label, and verify PNG download/share.
- Keep the NIIMBOT mobile app installed and paired with the printer.

## Supabase checklist

- Run `supabase/schema.sql` and all migrations in `supabase/migrations`.
- Confirm RLS is enabled on `clients`, `people`, `client_people`, `productions`,
  `production_share_tokens`, `production_roster`, and `orders`.
- Confirm obsolete print-station tables are absent after the latest migration:
  `printer_devices`, `label_print_jobs`, and `label_print_attempts`.
- Confirm the `person-photos` storage bucket and policies exist.
- Confirm the client user can sign in and that their Supabase user has
  `app_metadata` set to `{"admin": true}`.
- Disable public email sign-ups unless intentionally onboarding more demo users.
- Verify a new client, person, photo, production, roster edit, order edit, and
  label printed flag persist after refresh on a second device.
- Do not use `NEXT_PUBLIC_ENABLE_AUTH=false` in production. That is local demo
  mode and writes only to that browser's `localStorage`.

## Label export checklist

- Open `/labels` on the phone expected to handle labels.
- Select the active production.
- Select one or more active labels.
- Confirm the preview is readable at small size.
- Tap **Share** if available, or **Download PNG**.
- Open the NIIMBOT app.
- Import the PNG and print using NIIMBOT's Bluetooth flow.
- Confirm the physical label is readable and not cropped.

## Current physical unknowns

- Exact NIIMBOT lid-label media.
- Round vs rectangular stock.
- Actual millimeter dimensions.
- DPI and import scaling behavior in the NIIMBOT app.
- Final physical print result after phone PNG import.

The current assumed preset is 50mm x 30mm at 300 DPI. Treat it as provisional
until a physical print confirms the media and import behavior.
`src/lib/niimbot-m2-preset.json` now describes itself as assumed/unverified.
Run [docs/production-readiness-checklist.md](production-readiness-checklist.md)
Section A to actually verify it, and update the preset description only
once that's done.

## Client demo script

1. Sign in at `/login`.
2. Open the active production from `/productions`.
3. Search for a known person, confirm or adjust their drink, and mark ordered.
4. Quick-add one guest, enter a simple drink, and save.
5. Open `/labels`; show the first active label selected automatically.
6. Download or share the PNG.
7. Open the NIIMBOT app and import the image.
8. Back on the production runner page, mark the same order picked up and delivered.
9. Show the Summary tab for the coffee-shop copy/paste view.

## Known limitations

- Direct NIIMBOT Bluetooth printing is not implemented in CTC. The NIIMBOT app
  owns Bluetooth pairing and physical printing.
- Web Share with files depends on the browser and OS. Use **Download PNG** when
  sharing is unavailable.
- The current export preset has not yet been physically verified against the
  final lid-label media.
- Offline production mode is not guaranteed with Supabase auth. Local demo mode
  is intentionally separate and browser-local.
- The app does not seed demo rows into Supabase automatically.

## Physical M2 test

- Verify the exact NIIMBOT M2 model, firmware, label roll, and mobile OS.
- Print a vendor-app test label.
- Export a Capture This Coffee PNG from `/labels` on the phone.
- Import that PNG into the NIIMBOT app.
- Record whether the app preserves 50mm x 30mm sizing or needs manual scaling.
- Confirm the label is readable after condensation handling on a cold cup.
- Record the final media, dimensions, DPI behavior, and any app import settings.
