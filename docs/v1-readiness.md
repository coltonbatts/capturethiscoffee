# Capture This Coffee V1 readiness

## Setup checklist

- Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- Set the server-only `SUPABASE_SERVICE_ROLE_KEY` for runner/printer APIs.
- Confirm `/login` signs in the client user and redirects to `/productions`.
- Create the real client, production, runner name, shoot date, and location.
- Add or import the day-of people before the shoot when possible.
- Generate the runner share link and confirm the runner board opens on a second
  device without sign-in.
- On a phone, open the production page and verify search, quick add, order edit,
  and status taps are comfortable one-handed.
- On the printer phone, open CTC Printer with the same runner share link,
  connect the M2_H, print one label, and confirm `label_printed` appears back on
  the runner board.
- Keep `/labels` available as fallback/advanced PNG and CSV export.

## Live sync behavior

- The authenticated operator production board subscribes to Supabase Realtime
  for `orders` changes and also polls every 10 seconds as a fallback.
- The public token runner deliberately polls the public production API every 10
  seconds. It does not connect to Supabase directly.
- CTC Printer stays on the token-scoped HTTP/PNG API and refreshes its queue on
  demand; it has no Supabase credentials.

## Supabase checklist

- Run `supabase/schema.sql` and all migrations in `supabase/migrations`, ending
  at `20260706120000_enable_orders_realtime.sql`.
- Confirm RLS is enabled on `clients`, `people`, `client_people`, `productions`,
  `production_share_tokens`, `production_roster`, and `orders`.
- Confirm obsolete print-station tables are absent after the latest migration:
  `printer_devices`, `label_print_jobs`, and `label_print_attempts`.
- Confirm the `person-photos` storage bucket and policies exist.
- Confirm the client user can sign in. Every signed-in user has full app access
  per `src/lib/auth.ts`; `app_metadata.admin` is historical and not required.
- Disable public email sign-ups unless intentionally onboarding more demo users.
- Verify a new client, person, photo, production, roster edit, order edit, and
  label printed flag persist after refresh on a second device.
- Confirm missing configuration shows a setup error and never creates
  browser-local application records.

## Primary print checklist

- Deploy or run CTC with `SUPABASE_SERVICE_ROLE_KEY` set for public API routes.
- Confirm the production status is `active`.
- Open CTC Printer on a physical iPhone.
- Paste the runner share link and link the production.
- Force-quit the official NIIMBOT app before connecting.
- Connect the NIIMBOT M2_H.
- Print one real order label.
- Confirm the same order shows `label_printed` in Supabase and the runner board.

## Fallback label export checklist

- Open `/labels` on the phone expected to handle labels.
- Select the active production.
- Select one or more active labels.
- Confirm the preview is readable at small size.
- Export CSV for NIIMBOT batch templates, or tap **Export PNG** / **Share** for
  an individual label asset.
- Open the official NIIMBOT app.
- Import the fallback asset and print using NIIMBOT's Bluetooth flow.
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
3. Search for a known person and confirm or adjust their drink.
4. Quick-add one guest, enter a simple drink, and save.
5. Copy the runner link and show that it is the same link CTC Printer uses.
6. In CTC Printer, print one pending label and mark it printed.
7. Back on the production runner page, show the printed badge and refresh once
   to demonstrate server state persistence.
8. Show `/labels` as fallback/advanced export, not the main print station.
9. Show the Summary tab for the coffee-shop copy/paste view.

## Known limitations

- Phase 4 verified the deployed signed-out route boundary, missing/invalid
  token rejection, and anonymous Supabase denial. A valid runner-token pass,
  physical CTC Printer output, and `label_printed` visible back in the web app
  still require operator access, an iPhone, and the NIIMBOT.
- Web Share with files depends on the browser and OS. Use **Download PNG** when
  sharing is unavailable on the `/labels` fallback screen.
- The current export preset has not yet been physically verified against the
  final lid-label media.
- Offline production mode is not supported. Supabase connectivity is required
  for authoritative application data.
- The app does not seed rows into Supabase automatically.

## Physical M2 test

- Verify the exact NIIMBOT M2 model, firmware, label roll, and mobile OS.
- Print a vendor-app test label.
- Print one Capture This Coffee label from CTC Printer.
- If testing fallback export, export a PNG or CSV from `/labels` and import it
  into the NIIMBOT app.
- Record whether the app preserves 50mm x 30mm sizing or needs manual scaling.
- Confirm the label is readable after condensation handling on a cold cup.
- Record the final media, dimensions, DPI behavior, and any app import settings.
