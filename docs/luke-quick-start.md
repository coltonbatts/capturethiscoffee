# Capture This — Luke’s quick start

Revision: 2026-07-27 / Build 10 controlled pilot

This is the whole routine. Once you do it once, it should feel pretty simple.

## Before you start

Grab:

- Your iPhone with **Capture This** installed.
- Confirm the app shows `1.0.0 (10)` and record the TestFlight expiration.
- The NIIMBOT M2_H printer.
- The owner-provisioned Capture This email/password.
- The name of the Active production day.

Make sure the printer has labels and ribbon in it. Don’t update its firmware,
even if the NIIMBOT app suggests it.

## Connect everything

1. Open **Capture This**.
2. Sign in and choose the Active day.
3. Confirm the production name before printing.
4. Fully close the regular NIIMBOT app if it is open on any nearby phone or
   tablet.
5. Turn off any other nearby NIIMBOT printers.
6. Turn on the M2_H and tap **Connect printer**.

If the app finds more than one printer, turn off the extras and try again.

## Print the labels

1. Tap **Refresh** to get the latest orders.
2. Double-check the person’s name and drink.
3. Tap the single-label **Print** action. Do not use **Print all**.
4. Inspect the paper and wait for the app's recovery/sync state before moving
   to another person.

Print one label at a time. Unattended batch printing is not supported.

## If something goes wrong

First, look at the printer and see whether a usable label came out.

- **A good label came out:** choose **Label printed — sync only**. This tells
  the shared production board it printed without printing a second copy.
- **Nothing came out:** choose **Nothing printed — retry**.
- **You aren’t sure:** stop and text Colton. Don’t guess and accidentally print
  a duplicate. Use the named support contact in the handoff if Colton is not
  the agreed support owner.

If the printer disconnects:

1. Leave the recovery message in the app.
2. Turn the printer off and back on.
3. Make sure the regular NIIMBOT app is fully closed.
4. Reconnect in Capture This and continue.

Never update the printer firmware as a troubleshooting step.

## If the app still won’t print

Use the support contact recorded on the shipped kit. Send:

- What you were trying to do.
- The exact error message.
- Whether a physical label came out.
- Your iPhone model and iOS version.

Don’t send a password, a production link, or a screenshot that shows private
crew data. A signed-in operator can use the authenticated `/labels` page for
fallback PNG/CSV export. If the owner asks you to use **Advanced · Legacy
link**, treat that production link as private.
