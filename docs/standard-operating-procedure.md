# Capture This Coffee SOP

Last updated: 2026-07-05

## Purpose

Capture This Coffee is the drink-order tool for a production day. The whole
workflow is one sentence: put today's people on the roster, collect their
drinks, print their labels. Each roster person either still needs their drink
order taken, has a drink captured, or is marked "no drink." Once drinks are
captured, labels print as a batch.

## Scope

Use this SOP for:

- Setting up a production before shoot day.
- Running the coffee workflow on set.
- Printing cup labels through CTC Printer, with `/labels` as fallback export.
- Recovering from common issues without stopping the order flow.
- Closing out the production after the run.

Related docs:

- [Label image export](label-image-export.md)
- [App experience map](app-experience-map.md)
- [V1 readiness checklist](v1-readiness.md)

## Systems

### Master Website

Use `https://coffee.capturethis.com` for shared production data.

The master website is the source of truth for:

- Clients.
- People.
- Productions.
- Rosters.
- Coffee orders.
- Printed label status.

Use the hosted website for setup, runner workflow, summaries, and fallback
label export.

### CTC Printer

The native iOS **CTC Printer** app is the primary on-set print path. It opens
the same runner share link, fetches the pending label queue from the public API,
prints to the NIIMBOT M2_H over Bluetooth LE, and marks each order
`label_printed`.

### `/labels` fallback

The web `/labels` screen is an authenticated fallback/advanced export screen for
PNG download/share, CSV batch export, preview, and test labels. Use it when CTC
Printer is unavailable or when a manual export is needed.

### Key Rule

CTC Printer prints on set. `/labels` exports assets when the primary path is
unavailable or an advanced export is needed.

## Roles

### Signed-in operator

The signed-in operator prepares the production and manages setup records. Every
signed-in Supabase user has full app access; older admin/staff metadata checks
are no longer part of the current app access model.

Responsibilities:

- Sign in at `/login`.
- Create and maintain clients.
- Add people and photos.
- Create productions.
- Build or update the production roster.
- Confirm the CTC Printer workflow on the phone before shoot day.
- Keep credentials, Supabase settings, and environment variables private.

### Runner

The runner operates the day-of coffee board.

Responsibilities:

- Open the active production.
- Search for people, or filter to "Needs order."
- Take each person's drink order, or mark "No drink" if they decline.
- Add guests when needed.
- Coordinate with the label operator once drinks are captured.

### PA / Label Operator

The label operator uses CTC Printer on the iPhone.

Responsibilities:

- Open CTC Printer.
- Paste or reuse the runner share link.
- Connect the NIIMBOT M2_H.
- Print pending labels.
- Confirm `label_printed` updates after successful prints.
- Inspect the physical output.

## Required Access

Signed-in operators need a Supabase Auth user. Per `src/lib/auth.ts`, every
signed-in user has full app access. Admin metadata such as
`{"admin": true}` is historical and not required by the current app.

Sign-in is required for setup and fallback export routes such as:

- `/people`
- `/labels`
- `/productions/new`

Runners do not need an account for the active day-of flow, but they must use a
production share link. The link token scopes reads and order edits to one
production. Anonymous direct Supabase table reads and order updates are not
allowed.

Keep public sign-ups disabled unless intentionally onboarding new staff. Access
control is invitation-based at the Supabase user level.

## Pre-Shoot Setup

Complete this at least one day before the production when possible.

### 1. Confirm App Configuration

- Confirm the deployed app opens at `https://coffee.capturethis.com`.
- Confirm `/login` accepts the intended operator account.
- Confirm the app uses Supabase-backed data, not local demo mode.
- Confirm `NEXT_PUBLIC_ENABLE_AUTH` is unset or `true` in production.
- Confirm `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are configured.

Production must not use `NEXT_PUBLIC_ENABLE_AUTH=false`. That mode stores data
only in the current browser's `localStorage`.

### 2. Confirm Database Readiness

In Supabase, confirm:

- `supabase/schema.sql` has been applied.
- All files in `supabase/migrations` have been applied in filename order.
- RLS is enabled on app tables.
- The `person-photos` storage bucket exists.
- Person photo uploads work after refresh.
- Obsolete print-station tables are absent: `printer_devices`,
  `label_print_jobs`, and `label_print_attempts`.

### 3. Create Production Records

In the app:

1. Open `/people`.
2. Add known crew, agency, clients, and guests when available.
3. Upload useful person photos where helpful.
4. Open `/productions/new`.
5. Enter the production name, date, location, client, and runner details.
6. Add the known roster.
7. Save the production.
8. Open the production page and confirm the runner board loads.

### 4. Verify Day-Of Flow

On the device the runner will use:

1. Open the active production.
2. Search for a known person.
3. Tap **Take order**, enter a drink, and save.
4. Mark another person **No drink** and confirm the progress count updates.
5. Quick-add a guest and save a simple drink.
6. Confirm the header shows the captured count and the **Print labels** batch
   action.

### 5. Verify CTC Printer

On the phone the PA will use:

1. Open or paste the runner share link in CTC Printer.
2. Connect the NIIMBOT M2_H.
3. Print one physical test label from the queue.
4. Confirm the web runner board shows the label as printed.
5. Record any scaling, cropping, readability, or `label_printed` issue.

If CTC Printer is unavailable, run the fallback `/labels` PNG or CSV export
flow in [label-image-export.md](label-image-export.md).

## Shoot-Day Startup

### Admin

- Sign in.
- Open the active production.
- Confirm the roster is correct.
- Confirm the runner can open the production page.
- Confirm the CTC Printer phone can open the runner share link.

### Runner

- Open the active production on the runner device.
- Confirm search and the "Needs order" filter work.
- Confirm taking an order saves.
- Confirm quick-add works if guests are expected.
- Watch the captured count and printed badges when coordinating with the label
  operator.

### Label Operator

- Confirm the NIIMBOT is powered on.
- Force-quit the official NIIMBOT app before connecting CTC Printer.
- Open CTC Printer on the phone.
- Refresh the queue and print one test label if this has not already been done
  that day.

## Standard Day-Of Workflow

### 1. Find or Add the Person

On the production page:

1. Search for the person.
2. If they exist, open their order.
3. If they do not exist, quick-add them.
4. Add a clear name and group.
5. Add a photo only if it helps identification and does not slow the line.

### 2. Take the Order

1. Tap **Take order** (the editor prefills from their usual order).
2. Confirm the drink with the person and edit as needed.
3. Save. The person now counts as captured.
4. If they don't want anything, tap **No drink** instead.
5. Keep the drink text short enough to read on a label.
6. Add notes only when they prevent a real mistake.

Good drink text examples:

- `Iced oat latte`
- `Hot black coffee`
- `Iced vanilla latte, almond`
- `Matcha, oat, light ice`

### 3. Watch the Progress Count

The header shows drinks captured out of the roster total, plus who still needs
an order. Use the "Needs order" filter to sweep the remaining people. The day
is collected when everyone is either captured or marked no drink.

### 4. Print Labels

Use labels when physical cup tracking or the Capture This Coffee brand moment is
needed.

Printing is batch-oriented: the queue and the `/labels` screen both cover every
captured drink for the day, and "unprinted" selection keeps reprints cheap.

From CTC Printer:

1. Confirm the production is active.
2. Confirm CTC Printer is linked to the runner share URL.
3. Refresh the queue.
4. Print each pending label.
5. Confirm the web day board shows the printed badge.
6. Inspect the physical label.

From the web (signed-in), tap **Print labels** on the production page to open
the batch on `/labels` with every captured drink preselected.

If CTC Printer is unavailable, use `/labels` for PNG or CSV fallback export.
Do not assume the current physical media is verified until a test print
confirms it.

## Fallback Procedures

### If the App Loses Connection

1. Stay on the current screen.
2. Wait a few seconds.
3. Use **Try again** if shown.
4. Check Wi-Fi or signal.
5. Refresh only if the page is not recovering.
6. Continue from the latest visible state.

### If an Order Save Fails

1. Read the error message.
2. Retry the same action once.
3. Confirm network connectivity.
4. Refresh the production page if the order state is unclear.
5. Reapply the change if needed.

### If CTC Printer Is Unavailable

1. Open `/labels`.
2. Select the production and labels.
3. Use **Export CSV** for NIIMBOT batch templates, or **Export PNG** for
   individual label assets.
4. Import the fallback asset in the official NIIMBOT app.
5. Test one physical label before printing a full run.

### If Share Is Unavailable On `/labels`

1. Use **Download PNG**.
2. Open the downloaded image from the phone.
3. Share or import it into the NIIMBOT app from the phone's file/photo picker.

### If the PNG Imports Cropped, Blank, Sideways, or Too Light

1. Stop printing duplicates.
2. Confirm the exported PNG preview is not blank in CTC.
3. Confirm the NIIMBOT app media size and orientation.
4. Check whether the app is scaling or fitting the image.
5. Test one label before printing a full batch.
6. Record the final import settings in [label-image-export.md](label-image-export.md).

## Post-Shoot Closeout

After the last drink run:

1. Confirm everyone on the roster is captured or marked no drink.
2. Export any label assets still needed.
3. Note any duplicate people, missing photos, bad drink names, label media
   issues, or workflow gaps.
4. Power down the NIIMBOT.
5. Save any operator notes for the next production.

## Data Hygiene

- Use real names where possible.
- Keep group names consistent, such as `Client`, `Agency`, `Crew`, `Set`, or `Guest`.
- Avoid creating duplicate people. Search before adding.
- Use person photos only when they help the runner identify people.
- Keep drink names readable and specific.
- Do not store sensitive personal information in drink notes.
- Do not share sign-in passwords in long-lived chat threads.

## Security Rules

- Never expose `SUPABASE_SERVICE_ROLE_KEY` in browser code or any `NEXT_PUBLIC_` variable.
- Keep `.env.local` local and uncommitted.
- Disable public sign-ups unless onboarding new users intentionally.
- Give Supabase sign-in access only to people who need setup permissions.
- Share runner links only with the on-set team, and revoke or expire them after
  the production.
- Do not use local demo mode for production data.
- Do not change hosted environment variables during a live run unless the tech lead approves it.

## Quality Checklist

- [ ] Signed-in operator can sign in.
- [ ] Active production opens for a signed-in operator and through the production share link.
- [ ] Client, people, roster, date, location, and runner details are correct.
- [ ] Runner can search, quick-add, take orders, and mark no-drink on the actual device.
- [ ] CTC Printer links to the same runner share URL.
- [ ] CTC Printer prints one physical test label and marks `label_printed`.
- [ ] `/labels` fallback loads on the phone.
- [ ] At least one fallback PNG or CSV exports successfully.
- [ ] Remaining physical unknowns are recorded before client use.
