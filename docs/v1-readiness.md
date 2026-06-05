# Capture This Coffee V1 readiness

## Setup checklist

- Deploy the app with `NEXT_PUBLIC_ENABLE_AUTH` unset or `true`.
- Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- Confirm `/login` signs in Luke and redirects to `/productions`.
- Create the real client, production, runner name, shoot date, and location.
- Add or import the day-of people before the shoot when possible.
- On a phone, open the production page and verify search, quick add, order edit,
  and status taps are comfortable one-handed.
- Keep `/labels` bookmarked for the fastest print station flow.

## Supabase checklist

- Run `supabase/schema.sql` and all migrations in `supabase/migrations`.
- Confirm RLS is enabled on `clients`, `people`, `client_people`, `productions`,
  `production_roster`, and `orders`.
- Confirm the `person-photos` storage bucket and policies exist.
- Confirm Luke has `app_metadata.staff: true`.
- Disable public email sign-ups unless intentionally onboarding more staff.
- Verify a new client, person, photo, production, roster edit, order edit, and
  label printed flag persist after refresh on a second device.
- Do not use `NEXT_PUBLIC_ENABLE_AUTH=false` in production. That is local demo
  mode and writes only to that browser's `localStorage`.

## Printer setup checklist

- Supported V1 path: browser print through the OS print dialog.
- Printer: NIIMBOT M2 with 50mm x 30mm label stock loaded.
- Orientation: use landscape if the driver asks.
- Scale: set to 100%, not fit to page.
- Margins: start with none. If the driver clips, test its default margin setting.
- Density: raise printer or driver density if text is faint.
- Alignment: use driver alignment controls if content is shifted or clipped.
- Print one label from the NIIMBOT app first to verify ribbon, media, density, and
  baseline alignment.
- In Capture This Coffee, use `/labels`, print one selected order, then tap
  `Mark printed` only after the physical label is correct.
- Treat `Experimental M2 check` as a Bluetooth capability probe only. Direct
  browser Bluetooth printing is not a V1 promise.

## Luke demo script

1. Sign in at `/login`.
2. Open the active production from `/productions`.
3. Search for a known person, confirm or adjust their drink, and mark ordered.
4. Quick-add one guest, enter a simple drink, and save.
5. Open `/labels`; show the first unprinted order selected automatically.
6. Print one label through the browser dialog.
7. If the label is correct, tap `Mark printed & next`.
8. Back on the production runner page, mark the same order picked up and delivered.
9. Show the Summary tab for the coffee-shop copy/paste view.

## Known limitations

- Direct NIIMBOT Bluetooth printing is not implemented. The app only probes for a
  likely BLE service/characteristic in compatible Chromium browsers.
- iOS Safari does not support the Web Bluetooth path; browser print remains the
  supported route.
- Browser print behavior depends on the installed OS driver and its saved paper
  size, margin, scale, density, and alignment settings.
- Offline production mode is not guaranteed with Supabase auth. Local demo mode is
  intentionally separate and browser-local.
- The app does not seed demo rows into Supabase automatically.
- Print completion cannot be detected reliably by the browser, so the app requires
  a human `Mark printed` confirmation.

## Tomorrow's physical M2 test

- Verify the exact NIIMBOT M2 model, firmware, label roll, and desktop/mobile OS.
- Print a 50mm x 30mm vendor-app test label.
- Print from Chrome desktop using `/labels`; record scale, orientation, margin,
  density, and alignment settings that work.
- Repeat from the actual phone/tablet Luke expects to use.
- Confirm the label is readable after condensation handling on a cold cup.
- Confirm `Print & next` followed by `Mark printed & next` keeps the queue moving.
- Test failure recovery: cancel print, do not mark printed, reprint the same label.
- Run `Experimental M2 check` in Chrome/Edge and record whether the device appears
  and whether the characteristic is found.
- Decide after the test whether V1 stays browser-print-only or needs a feature-
  flagged direct-print spike.
