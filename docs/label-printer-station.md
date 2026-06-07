# Capture This Coffee label printer station

Last setup check: 2026-06-07 on macOS.

## Local app setup

- Install dependencies with `npm install`.
- Create `.env.local` from `.env.example`.
- For a local-only print station without Supabase credentials, use:

```bash
NEXT_PUBLIC_ENABLE_AUTH=false
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

- Start the workstation with `npm run dev`.
- Main print workstation: `http://localhost:3000/labels`.
- Queue station: `http://localhost:3000/labels/station`.
- Queue mode requires Supabase auth and the label print-job migration.

## macOS printer detection

Run:

```bash
lpstat -p
lpstat -v
system_profiler SPUSBDataType
```

On the 2026-06-07 laptop setup, CUPS only reported:

```text
printer HP_LaserJet_M402dw__E3221E_ is idle.
device for HP_LaserJet_M402dw__E3221E_: dnssd://HP%20LaserJet%20M402dw%20(E3221E)._ipps._tcp.local./?uuid=50484256-4633-3838-3632-80ce62e3221e
```

No NIIMBOT printer was registered in CUPS, and `system_profiler SPUSBDataType`
did not list a connected USB device from this session.

## NIIMBOT app setup

If macOS does not expose the printer in the print dialog, use the official
NIIMBOT desktop/app path first:

- Official download center:
  `https://www.niimbot.com/us/downloadCenter?sub_id=undefined`
- NIIMBOT's download page says the Mac version currently supports M2_H on
  macOS 12 and above. If using a regular M2 and the Mac app will not connect,
  verify with the iPhone app first and use the PNG fallback from the web app.

Before testing Capture This Coffee:

1. Power on the NIIMBOT M2/M2_H.
2. Connect with a USB-C data cable, not a charge-only cable.
3. Load 50mm x 30mm label stock and the correct ribbon.
4. Print a 50mm x 30mm test label from the NIIMBOT app.

## Browser print settings

Use these settings for `/labels` or `/labels/station` browser printing:

- Printer: NIIMBOT M2/M2_H driver or desktop app print target.
- Label stock: 50mm x 30mm.
- Scale: 100%, not fit to page.
- Margins: none.
- Orientation: landscape if the driver asks.
- Density: increase in the driver/app if text is faint.
- Alignment: use the app's calibration controls only after the vendor-app test
  label prints correctly.

Only tap `Mark printed` or `Mark printed & next` after the physical label is
correct.

## PNG fallback

If the browser or OS print dialog does not expose the NIIMBOT printer:

1. Open `http://localhost:3000/labels/station`.
2. Claim/select the label job.
3. Click `Download PNG`.
4. Import the downloaded `*-50x30mm-300dpi.png` file into the NIIMBOT desktop
   app.
5. Print at 50mm x 30mm, 100% scale, no margins.
6. Mark the job printed only after the physical label is correct.

The station PNG is rendered at 591 x 354 pixels, matching 50mm x 30mm at
300 DPI.

## Confirmed working profile

Pending physical printer validation on this laptop. Fill this in after both the
NIIMBOT app test label and Capture This Coffee test label print correctly:

- Printer model:
- Connection:
- NIIMBOT app version:
- macOS version:
- Label stock:
- Ribbon:
- Browser:
- Browser print target:
- Orientation:
- Scale:
- Margins:
- Density:
- Alignment/calibration:
- PNG fallback needed:
- Notes:
