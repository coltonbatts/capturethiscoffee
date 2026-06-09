# Capture This Coffee V1 readiness

## Setup checklist

- Deploy the app with `NEXT_PUBLIC_ENABLE_AUTH` unset or `true`.
- Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- Confirm `/login` signs in Luke and redirects to `/productions`.
- Create the real client, production, runner name, shoot date, and location.
- Add or import the day-of people before the shoot when possible.
- On a phone, open the production page and verify search, quick add, order edit,
  and status taps are comfortable one-handed.
- Keep `/labels` bookmarked for direct browser-print fallback and
  `/labels/station` bookmarked on the print-station laptop for queued jobs.
- Keep the NIIMBOT laptop runbook handy:
  [label-printer-station.md](label-printer-station.md).

## Supabase checklist

- Run `supabase/schema.sql` and all migrations in `supabase/migrations`.
- Confirm RLS is enabled on `clients`, `people`, `client_people`, `productions`,
  `production_roster`, `orders`, `printer_devices`, `label_print_jobs`, and
  `label_print_attempts`.
- Confirm the `person-photos` storage bucket and policies exist.
- Confirm Luke can sign in and that his Supabase user has `app_metadata` set to
  `{"admin": true}`. The app proxy requires admin metadata to access `/clients`,
  `/people`, `/labels`, and `/productions/new`.
- Disable public email sign-ups unless intentionally onboarding more demo users.
- Verify a new client, person, photo, production, roster edit, order edit, and
  label printed flag persist after refresh on a second device.
- Verify `/labels` can queue a selected label and `/labels/station` can claim,
  print or download PNG, and complete that queued job.
- Do not use `NEXT_PUBLIC_ENABLE_AUTH=false` in production. That is local demo
  mode and writes only to that browser's `localStorage`.

## Printer setup checklist

- Supported V1 path: browser print through the OS print dialog. The remote
  station queue is supported for moving jobs from `/labels` to
  `/labels/station`; the actual physical print still uses browser print or PNG
  import.
- Printer: NIIMBOT M2/M2_H with 50mm x 30mm label stock loaded.
- Orientation: use landscape if the driver asks.
- Scale: set to 100%, not fit to page.
- Margins: start with none. If the driver clips, test its default margin setting.
- Density: raise printer or driver density if text is faint.
- Alignment: use driver alignment controls if content is shifted or clipped.
- Print one label from the NIIMBOT app first to verify ribbon, media, density, and
  baseline alignment.
- In Capture This Coffee, use `/labels` to browser-print one selected order, or
  queue labels to `/labels/station` and print from the station laptop. Tap
  `Mark printed` or `Mark printed & next` only after the physical label is
  correct.
- Treat `Experimental M2 check` as a Bluetooth capability probe only. Direct
  browser Bluetooth printing is not a V1 promise.
- Treat the M2_H USB serial scripts as diagnostics/spikes. They have confirmed
  USB serial probing and low-density bitmap/glyph progress, but direct app-label
  USB printing is not the live-demo supported path yet.

## Luke demo script

1. Sign in at `/login`.
2. Open the active production from `/productions`.
3. Search for a known person, confirm or adjust their drink, and mark ordered.
4. Quick-add one guest, enter a simple drink, and save.
5. Open `/labels`; show the first unprinted order selected automatically.
6. Print one label through the browser dialog, or queue it and open
   `/labels/station` on the print-station laptop.
7. If the physical label is correct, tap `Mark printed & next` in the active
   print view.
8. Back on the production runner page, mark the same order picked up and delivered.
9. Show the Summary tab for the coffee-shop copy/paste view.

## Known limitations

- Direct NIIMBOT Bluetooth printing is not implemented. The app only probes for a
  likely BLE service/characteristic in compatible Chromium browsers.
- iOS Safari does not support the Web Bluetooth path; browser print remains the
  supported route.
- Direct M2_H USB serial printing is not productized in the app. Current scripts
  are diagnostic/local-worker progress and require an operator who understands
  the runbook.
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
- Print from Chrome desktop using `/labels` and `/labels/station`; record scale,
  orientation, margin, density, and alignment settings that work.
- Repeat from the actual phone/tablet Luke expects to use.
- Confirm the label is readable after condensation handling on a cold cup.
- Confirm browser print followed by `Mark printed & next` keeps the local and
  remote station queues moving.
- Test failure recovery: cancel print, do not mark printed, reprint the same label.
- Run `Experimental M2 check` in Chrome/Edge and record whether the device appears
  and whether the characteristic is found.
- Decide after the test whether V1 stays browser-print-only or needs a feature-
  flagged direct-print spike.
