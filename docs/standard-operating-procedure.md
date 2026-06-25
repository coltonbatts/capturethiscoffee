# Capture This Coffee SOP

Last updated: 2026-06-24

## Purpose

Capture This Coffee is the live coffee order system for a production day. It
tracks clients, people, productions, crew drink orders, order status, and label
asset export. The goal is simple: every person gets the right drink, the runner
knows what is next, and label creation does not require a laptop print station.

## Scope

Use this SOP for:

- Setting up a production before shoot day.
- Running the coffee workflow on set.
- Exporting cup label PNGs for NIIMBOT app printing.
- Recovering from common issues without stopping the order flow.
- Closing out the production after the run.

Related docs:

- [Label image export](label-image-export.md)
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

Use the hosted website for admin setup, runner workflow, summaries, and label
PNG export.

### NIIMBOT App

The NIIMBOT first-party app owns printer pairing and physical Bluetooth
printing. Capture This Coffee does not drive the NIIMBOT over USB, Bluetooth, or
a custom queue.

### Key Rule

CTC generates the label image. The NIIMBOT app prints it.

## Roles

### Admin

The admin prepares the production and manages setup records.

Responsibilities:

- Sign in at `/login`.
- Create and maintain clients.
- Add people and photos.
- Create productions.
- Build or update the production roster.
- Confirm the label export workflow on the phone before shoot day.
- Keep credentials, Supabase settings, and environment variables private.

### Runner

The runner operates the day-of coffee board.

Responsibilities:

- Open the active production.
- Search for people.
- Confirm or edit drink orders.
- Add guests when needed.
- Move orders through the correct statuses.
- Use the Summary tab for coffee-shop handoff.
- Coordinate label export when physical labels are required.

### PA / Label Operator

The label operator uses the phone and NIIMBOT app.

Responsibilities:

- Open `/labels` on the phone.
- Select the production and label.
- Confirm the preview is readable.
- Download or share the PNG.
- Import the PNG in the NIIMBOT app.
- Inspect the physical output.

## Required Access

Admins need a Supabase Auth user with admin metadata:

```json
{"admin": true}
```

Admin access is required for setup routes such as:

- `/clients`
- `/people`
- `/labels`
- `/productions/new`

Runners do not need an account for the active day-of flow, but they must use a
production share link. The link token scopes reads and order edits to one
production. Anonymous direct Supabase table reads and order updates are not
allowed.

Keep public sign-ups disabled unless intentionally onboarding new staff.

## Pre-Shoot Setup

Complete this at least one day before the production when possible.

### 1. Confirm App Configuration

- Confirm the deployed app opens at `https://coffee.capturethis.com`.
- Confirm `/login` accepts the admin account.
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

1. Open `/clients`.
2. Create or confirm the client.
3. Open `/people`.
4. Add known crew, agency, clients, and guests when available.
5. Upload useful person photos where helpful.
6. Open `/productions/new`.
7. Enter the production name, date, location, client, and runner details.
8. Add the known roster.
9. Save the production.
10. Open the production page and confirm the runner board loads.

### 4. Verify Day-Of Flow

On the device the runner will use:

1. Open the active production.
2. Search for a known person.
3. Edit or confirm their drink.
4. Mark the order ordered.
5. Mark the order picked up.
6. Mark the order delivered.
7. Quick-add a guest and save a simple drink.
8. Open the Summary tab and confirm copy/paste output is useful.

### 5. Verify Label Export

On the phone the PA will use:

1. Open `/labels`.
2. Select the active production.
3. Select one or more active labels.
4. Confirm the preview is readable.
5. Tap **Share** if available, or **Download PNG**.
6. Open the NIIMBOT app.
7. Import the PNG and print one physical test label.
8. Record any scaling, cropping, or readability issue.

## Shoot-Day Startup

### Admin

- Sign in.
- Open the active production.
- Confirm the roster is correct.
- Confirm the runner can open the production page.
- Confirm `/labels` loads on the label phone.

### Runner

- Open the active production on the runner device.
- Confirm search works.
- Confirm status taps save.
- Confirm quick-add works if guests are expected.
- Keep the Summary tab available for coffee-shop ordering.

### Label Operator

- Confirm the NIIMBOT is powered on and paired in the NIIMBOT app.
- Open `/labels` on the phone.
- Export and print one test label if this has not already been done that day.

## Standard Day-Of Workflow

### 1. Find or Add the Person

On the production page:

1. Search for the person.
2. If they exist, open their order.
3. If they do not exist, quick-add them.
4. Add a clear name and group.
5. Add a photo only if it helps identification and does not slow the line.

### 2. Confirm the Drink

1. Confirm the current drink with the person.
2. Edit the drink if needed.
3. Keep the drink text short enough to read on a label.
4. Add notes only when they prevent a real mistake.

Good drink text examples:

- `Iced oat latte`
- `Hot black coffee`
- `Iced vanilla latte, almond`
- `Matcha, oat, light ice`

### 3. Move the Order Through Statuses

Use statuses consistently:

- `Not asked`: Drink has not been confirmed yet.
- `Confirmed`: Drink exists but has not been ordered yet.
- `Ordered`: Drink has been sent to the coffee shop or runner queue.
- `Picked up`: Drink has been received from the coffee shop.
- `Delivered`: Drink has reached the person.

Only mark a drink delivered after handoff.

### 4. Use Summary for Coffee-Shop Handoff

Use the Summary tab when sending the grouped order to the coffee shop.

Before sending:

- Check for duplicates.
- Check milk alternatives.
- Check hot versus iced.
- Check guest names.
- Check any high-risk notes, such as decaf or allergies.

### 5. Export Labels

Use labels when physical cup tracking or the Capture This Coffee brand moment is
needed.

From `/labels`:

1. Select the production.
2. Select the label or labels.
3. Confirm the label preview is readable.
4. Tap **Share** if supported, or **Download PNG**.
5. Open the NIIMBOT app.
6. Import the PNG and print.
7. Inspect the physical label.

If a label prints incorrectly, export again or adjust import settings in the
NIIMBOT app. Do not assume the current physical media is verified until a test
print confirms it.

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

### If Share Is Unavailable

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

1. Confirm all delivered drinks are marked delivered.
2. Export or copy any needed Summary information.
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
- Do not share admin passwords in long-lived chat threads.

## Security Rules

- Never expose `SUPABASE_SERVICE_ROLE_KEY` in browser code or any `NEXT_PUBLIC_` variable.
- Keep `.env.local` local and uncommitted.
- Disable public sign-ups unless onboarding new users intentionally.
- Give admin access only to people who need setup permissions.
- Share runner links only with the on-set team, and revoke or expire them after
  the production.
- Do not use local demo mode for production data.
- Do not change hosted environment variables during a live run unless the tech lead approves it.

## Quality Checklist

- [ ] Admin can sign in.
- [ ] Active production opens for an admin and through the production share link.
- [ ] Client, people, roster, date, location, and runner details are correct.
- [ ] Runner can search, quick-add, edit drinks, and update statuses on the actual device.
- [ ] Summary output is accurate enough for coffee-shop handoff.
- [ ] `/labels` loads on the phone.
- [ ] At least one PNG downloads or shares successfully.
- [ ] The PNG imports into the NIIMBOT app.
- [ ] One physical test label has printed correctly.
- [ ] Remaining physical unknowns are recorded before client use.
