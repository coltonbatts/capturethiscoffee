# Luke Quick Start — Capture This printer

Use this guide only after the handoff record names the supported Capture This
version/build and the exact accepted NIIMBOT M2_H. Never update the printer
firmware as a troubleshooting step.

## What you need

- The accepted NIIMBOT M2_H, its charger/cable, installed ribbon, and the
  recorded label stock.
- An iPhone running the iOS version recorded in the acceptance test.
- The supported Capture This app. Install it from the verified unlisted App
  Store link. If the handoff is still in a TestFlight pilot, install the named
  current TestFlight build and remember that it expires after 90 days.
- Internet access and a private runner link for one active production.
- For fallback only: a signed-in Capture This web account and the official
  NIIMBOT app.

## Link and connect

1. Open **Capture This** on the iPhone.
2. Paste the complete runner link supplied privately by the production
   coordinator, then tap **Link production**. Do not screenshot or forward it.
3. Force-quit the official NIIMBOT app on every nearby phone or tablet.
4. Power off every nearby NIIMBOT printer except the accepted M2_H.
5. Wake the accepted printer and tap **Connect printer**.
6. Check the displayed printer name against the asset/serial record. Stop if
   Capture This finds a different model or more than one printer.

## Print and refresh

1. Tap **Refresh** after the runner changes or adds orders.
2. Review the pending name and drink before tapping **Print**.
3. After a physical success, wait for Capture This to report that the label
   synchronized. On the hosted production board, that order should show its
   printed badge.
4. Use the printed-label filter only for an intentional, confirmed reprint.

**Sync only** means the physical label already printed and Capture This is only
retrying the server update. It does not send another label to the printer.

If a print is interrupted or the result is uncertain, inspect the printer and
the physical stock before touching the app:

- A usable label exists: choose **Label printed — sync only**.
- Nothing printed: choose **Nothing printed — retry**.
- You cannot tell: stop and ask the production coordinator. Do not guess and
  create a duplicate.

For a reconnect problem, keep the recovery record in the app, power-cycle the
printer, confirm the official NIIMBOT app is still closed, reconnect the same
M2_H, refresh, and continue. Do not update firmware.

## `/labels` fallback

1. Ask a signed-in operator to open
   `https://coffee.capturethis.com/labels`.
2. Select the active production and only the required labels.
3. Use PNG for an individual/high-control label or CSV for a NIIMBOT batch
   template.
4. Open the official NIIMBOT app, import the asset, select the accepted stock
   size/orientation, and print one test label before a batch.
5. Treat fallback printing as manual: confirm printed status on the hosted
   board with the production coordinator.

## When something fails

Contact: **OWNER INPUT — support person/mailbox and day-of phone**

Record only:

- Date/time, iPhone model, iOS, Capture This version/build.
- Printer asset/serial, firmware, ribbon, stock, and measured label size.
- Last successful step, exact sanitized error text, and whether a physical
  label came out.
- A fictional-data photo if output quality is the problem.

Never send a runner link/token, password, service key, signing file, real
client data, or a screenshot containing any of those items.
