# Capture This Coffee client presentation brief

Prepared Sunday, July 5, 2026 for the Monday, July 6, 2026 client conversation.

## Core message

Capture This Coffee has moved from a working prototype into a coherent on-set
system: setup lives in the web app, runners use a scoped production link, label
printing now has a native iOS path, and fallback exports remain available when
needed.

The honest readiness line: the app and printer code are green in local checks,
but paid V1 still needs one deployed, physical NIIMBOT validation pass on the
real label stock.

## Meeting shape

1. Open with the product loop: prepare, run, print, hand off, close out.
2. Demo from the live app, not from the document.
3. Show the active production, confirm or edit one drink, advance the status,
   then show the runner/printer link.
4. Show CTC Printer if physical stock is ready. If not, explain the print queue
   and show `/labels` as the fallback export path.
5. Close by asking which next lane matters most: live sync, label polish, or
   team onboarding.

## What is working now

- Supabase-backed persistent clients, people, productions, rosters, orders, and
  person photos.
- Google sign-in and email/password auth for operators.
- Runner access through a production share-token URL, with no runner account
  required.
- Token-scoped public APIs for runner payloads, label queues, label PNGs, and
  operational order updates.
- Native iOS CTC Printer app in `mobile/` for NIIMBOT M2_H printing over BLE.
- `/labels` fallback screen for PNG, share, preview, test labels, and CSV batch
  export.
- RLS/security model documented and covered by share-token helper tests.
- Current local seeded demo path with "Northstar Trail Launch" data.

## Verification run

Run on July 5, 2026:

```bash
npm test
npm run lint
npm run build
flutter analyze
flutter test
```

Result:

- `npm test`: 37 tests passing.
- `npm run lint`: no reported issues.
- `npm run build`: Next.js 16.2.6 production build passing.
- `flutter analyze`: no issues found.
- `flutter test`: 2 tests passing.

Note: Flutter reported newer dependency versions available, but the current
locked app analyzes and tests cleanly.

## Remaining readiness risks

- Physical NIIMBOT stock is still the key unknown: exact media, dimensions,
  import/scaling behavior, and real cup readability need confirmation.
- The full deployed print loop still needs to be validated with real data:
  runner link -> CTC Printer -> physical print -> `label_printed` visible on
  the web board.
- Production setup should be checked before any real shoot: env vars, RLS,
  storage policies, public sign-up setting, client user, real roster, second
  device runner link, and printer phone.
- Offline production mode is not guaranteed with Supabase auth. Local demo mode
  is intentionally browser-local and not production data.

## Demo script

1. Open `https://coffee.capturethis.com/login`.
2. Sign in with Google.
3. Open the active production from `/productions`.
4. Search for a known person and confirm the drink.
5. Mark the order through the next status.
6. Open or copy the runner link and explain that CTC Printer uses the same URL.
7. In CTC Printer, link the production, refresh the queue, and print one label
   if the physical printer is ready.
8. Return to the runner board and show the printed badge.
9. Show `/labels` only as fallback or advanced export.
10. Show the coffee-shop summary if useful for the handoff conversation.

## Recommended client ask

Ask Luke to pick the next priority after the physical print validation:

- **Live sync:** multiple phones see board and label-status changes without
  manual refresh.
- **Label polish:** finalize stock, label styles, scaling, and print quality.
- **Team onboarding:** make runner links, staff access, and setup handoff easier
  for the client to own.

Recommended close: validate the printer loop, pick one next lane, and define
the paid V1 milestone around that lane.

## Prepared assets

- PowerPoint deck: `outputs/capture-this-coffee-client-state-2026-07-06.pptx`
- Rendered deck preview: `outputs/capture-this-coffee-client-state-2026-07-06-montage.png`
- Local app screenshots: `outputs/presentation-assets/`
