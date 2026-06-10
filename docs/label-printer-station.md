# Capture This Coffee label printer station

Last setup check: 2026-06-07 on macOS.

## Operating model

`coffee.capturethis.com` is the master queue and source of truth. It stores
productions, orders, label payloads, queue state, and print attempts.

The NIIMBOT is controlled by a local station running on the same laptop as the
printer. Hosted/serverless code cannot access a USB or Bluetooth printer plugged
into a person's machine. Open the station from `http://localhost:3000`, not from
the deployed domain, when using **Print via USB**.

Printer serial numbers are useful for confirming identity, but they do not go in
the master website env. The station uses the local device path reported by macOS,
for example `LABEL_SERIAL_PORT=/dev/cu.usbmodem83201`.

## Repeatable new laptop setup

1. Install dependencies with `npm install`.
2. Create `.env.local` from `.env.example`.
3. Set Supabase browser auth values:

```bash
NEXT_PUBLIC_ENABLE_AUTH=true
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

4. Plug in and power on the NIIMBOT.
5. Run the read-only probe:

```bash
npm run niimbot:probe
```

6. If more than one `/dev/cu.usbmodem*` device appears, probe each one until the
   NIIMBOT returns identity and firmware:

```bash
npm run niimbot:probe -- /dev/cu.usbmodem83201
```

7. Save the responding port in `.env.local`:

```bash
LABEL_SERIAL_PORT=/dev/cu.usbmodem83201
LABEL_SERIAL_API_BASE_URL=http://localhost:3000
```

8. Run a read-only status check:

```bash
npm run niimbot:status -- /dev/cu.usbmodem83201
```

9. Start the local station:

```bash
npm run dev
```

10. Open `http://localhost:3000/labels/station`, sign in, queue one label from
    `/labels`, click **Print via USB**, and confirm the physical label before
    marking the job printed.

Browser print and PNG download are the fallback paths if USB fails.

## Local app setup

- Install dependencies with `npm install`.
- Create `.env.local` from `.env.example`.
- For the live-demo queue station, set Supabase auth values and leave
  `NEXT_PUBLIC_ENABLE_AUTH` unset or `true`:

```bash
NEXT_PUBLIC_ENABLE_AUTH=true
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

- For local-only browser print without the remote queue, use:

```bash
NEXT_PUBLIC_ENABLE_AUTH=false
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

- Start the workstation with `npm run dev`.
- Main print workstation: `http://localhost:3000/labels`.
- Queue station: `http://localhost:3000/labels/station`.
- On the printer laptop, the queue station can print the selected queued,
  claimed, or printing label through local NIIMBOT M2_H USB serial with
  **Print via USB**. Browser print and PNG download remain available as
  fallbacks.
- Queue mode requires Supabase auth and the label print-job migration. Any
  signed-in Supabase app user can use the station under the current shared-demo
  policy; no `app_metadata.staff` flag is required.
- For lowest-friction printer-laptop operation, enable local print-station YOLO
  mode. This bypasses auth only for `/api/print-jobs*` station routes and uses
  the server-only Supabase service role key internally:

```bash
PRINT_STATION_YOLO=true
NEXT_PUBLIC_PRINT_STATION_YOLO=true
SUPABASE_SERVICE_ROLE_KEY=
PRINT_STATION_USER_ID=
LABEL_SERIAL_PORT=/dev/cu.usbmodem83201
```

`PRINT_STATION_USER_ID` is optional if the Supabase project has at least one
Auth user; when omitted, the station records attempts under the first Auth user.
Do not prefix `SUPABASE_SERVICE_ROLE_KEY` with `NEXT_PUBLIC_`.

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

No NIIMBOT printer was registered in CUPS.

The same MacBook does see the directly connected printer over USB serial:

- macOS USB name: `NIIMBOT M2_H LABEL PRINTER`
- USB vendor/product: `0x3513 / 0x0002`
- Serial: `M2_H-I409130491`
- Serial device: `/dev/cu.usbmodem1101`
- Read-only identity response: `#10001:V01.01,M2_H-I409130491,1*7C#`

This means CUPS is not the confirmed path for this M2_H. The supported
printer-laptop path is local USB serial from the queue station. Browser print
and PNG import remain fallback paths.

## USB serial probe

Before attempting any print protocol work, run the safe read-only probe:

```bash
npm run niimbot:probe
```

To target a specific device:

```bash
npm run niimbot:probe -- /dev/cu.usbmodem1101
```

The probe detects `/dev/cu.usbmodem*` ports, opens the selected port, sends only
read-only identity/version query frames for `#10001` and `#10003`, waits with
short timeouts, prints the responses, and closes the serial handle. It must not
print, feed, beep, move the motor, or mutate printer state.

For protocol-level status checks:

```bash
npm run niimbot:status -- /dev/cu.usbmodem1101
```

This sends heartbeat/status/RFID read requests only and prints raw response
frames for diagnosis.

## USB test print

After the read-only probe succeeds and a label roll/ribbon are loaded, the next
small direct-print test is the printer's own test page command:

```bash
npm run niimbot:test-print -- --yes /dev/cu.usbmodem1101
```

This sends the NIIMBOT protocol `PrintTestPage` packet
`55 55 5a 01 01 5a aa aa`. It may consume a label. It does not send a Capture
This Coffee raster label yet.

Observed 2026-06-07 response from `/dev/cu.usbmodem1101`:

```text
> 55 55 5a 01 01 5a aa aa
< 55 55 6a 01 ff 94 aa aa
```

The response is a valid `0x6a` frame for `PrintTestPage`. Physical output still
needs human confirmation at the printer.

Physical result: no label printed. Treat `ff` as a non-success response until
the M2_H command sequence and media/ribbon status are better understood.

Follow-up status probe after the no-print result:

```text
Heartbeat
> 55 55 dc 01 04 d9 aa aa
< 55 55 d9 0b 20 21 04 4a 00 00 01 01 00 00 00 9d aa aa

PrintStatus
> 55 55 a3 01 01 a3 aa aa
< 55 55 b3 0a 00 00 00 00 0a f0 00 00 00 00 43 aa aa

PrinterStatusData
> 55 55 a5 01 01 a5 aa aa
< 55 55 b5 0d 30 30 da c0 00 c8 00 00 00 14 00 03 01 7c aa aa

RfidInfo
> 55 55 1a 01 01 1a aa aa
< 55 55 1b 28 88 1d 3e 19 d9 14 10 80 09 30 34 32 32 32 35 30 30 35 10 50 5a 31 49 33 30 34 35 34 30 30 30 37 30 34 36 01 0e 00 02 01 8e aa aa
```

The next real print attempt should use a full model-appropriate print task
sequence, not the standalone `PrintTestPage` command.

## USB diagnostic print result

First physical direct-USB print success:

```bash
npm run niimbot:print-diagnostic -- --yes /dev/cu.usbmodem101
```

Physical result: the M2_H printed three solid horizontal bars. No readable text
was attempted in this diagnostic. This confirms the local USB serial path can
execute a full print task with bitmap row data.

The diagnostic sequence accepted setup and row packets, then returned
`PrintStatus` plus an unexpected `0xd3` frame after `PageEnd` instead of the
documented `0xe4` response. A cleanup command was sent afterward:

```text
> 55 55 da 01 01 da aa aa
< 55 55 d0 01 01 d0 aa aa
```

Next protocol step: print a tiny deterministic glyph pattern, not the full app
label yet, to confirm row direction, x-axis direction, bit packing, margins, and
the correct end-of-page/status handling for M2_H firmware `1.50`.

## USB glyph calibration print

Confirmed physical direct-USB glyph print success on 2026-06-08:

```bash
npm run niimbot:print-glyph-test -- --yes /dev/cu.usbmodem101
```

The M2_H requires the B1-style task for reliable physical printing from USB
serial:

- `SetDensity(1)`.
- `SetLabelType(1)`.
- B1 `PrintStart` with seven data bytes:
  `00 01 00 00 00 00 00`.
- `PageStart(1)`.
- Six-byte `SetPageSize(rows=354, cols=567, copies=1)`.
- Padded 354-row bitmap stream for the 567-pixel printhead.
- Bitmap row black-pixel count segment in total mode: `[00, low, high]`.
- `PageEnd(1)`.
- Poll `PrintStatus` until it reports `page=1`, `printProgress=100`, and
  `feedProgress=100`.
- `PrintEnd(1)`.

The earlier D110M_V4-style task and the early B1 task both accepted setup, row,
`PageEnd`, and `PrintEnd` frames but did not physically print. The key
breakthrough was not sending `PrintEnd` on the first `0xb3` status response.
The first status response reported `page=0`; the printer only printed once the
script waited for page completion.

The successful run progressed as:

```text
PrintStatus: page=0 printProgress=0 feedProgress=0
PrintStatus: page=0 printProgress=12 feedProgress=0
PrintStatus: page=0 printProgress=42 feedProgress=0
PrintStatus: page=0 printProgress=70 feedProgress=0
PrintStatus: page=0 printProgress=98 feedProgress=0
PrintStatus: page=1 printProgress=100 feedProgress=100
PrintEnd -> f4 data=01
```

The glyph test prints a sparse border box, `TOP`, `LEFT`, and `USB OK` from
built-in block glyphs. It does not render app labels, load fonts, or send more
than one page.

Safety controls:

- Requires `--yes`.
- Detects `/dev/cu.usbmodem*` if no port is supplied.
- Uses bounded nonblocking write retries and preserves partial writes.
- Paces B1 row writes conservatively and passively drains pending frames between
  row batches.
- Uses read timeouts for setup, page end, status, and abort cleanup.
- Closes the serial handle in `finally`.
- Sends cancel `0xda` if the script aborts after `PrintStart` and before
  `PrintEnd`.
- Writes a raw request/response transcript under `logs/`.

Do not use `0xda` as a commit command. Observed behavior indicates it is
`CancelPrint`; it only repositioned media when sent after `PrintEnd`.

Reconfirmed on 2026-06-09 from this printer laptop:

- Printer port: `/dev/cu.usbmodem83201`
- Identity: `M2_H-I409130491`
- Firmware: `1.50`
- Physical result: sparse border, `TOP`, `LEFT`, and `USB OK` printed exactly
  as expected.
- Transcript:
  `logs/niimbot-glyph-2026-06-09T14-33-00-207Z.log`

## USB queue station print

Start the app on the printer laptop:

```bash
npm run dev
```

Open `http://localhost:3000/labels/station`, sign in, select a queued label,
and click **Print via USB**. The station calls the local one-shot serial worker
through `/api/print-jobs/:id/usb-print`.

If the page is open at `coffee.capturethis.com`, **Print via USB** stays
disabled even when the browser Bluetooth check says `M2_H-I409130491 connected`.
That Bluetooth status only proves this browser can see the printer. USB printing
requires the Next.js route and serial worker to run on the printer laptop, so
open `http://localhost:3000/labels/station` on that laptop.

The station page checks `/api/print-station/local-readiness` to confirm it is
served from a local host and that the local server can see the configured
`LABEL_SERIAL_PORT`, for example `/dev/cu.usbmodem83201`.

The USB path:

- Reuses the stored `label_print_jobs.payload.label` (`CoffeeLabel`) instead of
  rebuilding label copy from live order data.
- Claims a queued selected job automatically, or uses an already claimed or
  printing selected job.
- Creates the print attempt with `transport: laptop_usb`.
- Marks the job complete only after the worker finishes the M2_H B1 print task
  and `PrintEnd` succeeds.
- Fails the job if the serial print path throws. Use browser print or PNG
  download as the fallback if the local USB device is unavailable.

Optional environment overrides:

```bash
LABEL_SERIAL_PORT=/dev/cu.usbmodem101
LABEL_SERIAL_API_BASE_URL=http://localhost:3000
```

For a terminal-only one-shot of the next queued label:

```bash
LABEL_SERIAL_AUTH_TOKEN=<supabase access token> npm run label:serial-worker -- --once
```

For a terminal-only one-shot of a specific selected job:

```bash
LABEL_SERIAL_AUTH_TOKEN=<supabase access token> npm run label:serial-worker -- --once --job-id=<label_print_job_id>
```

## USB layout bitmap print

After glyph calibration confirms the M2_H row direction, x-axis direction, bit
packing, and margins, run one deterministic layout bitmap:

```bash
npm run niimbot:print-layout-test -- --yes /dev/cu.usbmodem101
```

This uses the same full print-task path as the glyph test. It sends one 354 x
567 pixel page, density `1`, label type `1`, explicit bitmap rows only, and a
fixed `CAPTURE / TEST / TOP LEFT` block-glyph layout. It does not render live
app data, load fonts, or send more than one page.

The script logs:

- Orientation marker assumptions: `TOP LEFT` near row 34, column 34.
- Bitmap dimensions and non-empty row count.
- Every setup, page end, status poll, print end, and cleanup frame.
- Every non-empty bitmap row packet.
- Serial handle cleanup in `finally`.

Safety controls:

- Requires `--yes`.
- Detects `/dev/cu.usbmodem*` if no port is supplied.
- Uses read timeouts for setup, page end, status, and abort cleanup.
- Closes the serial handle in `finally`.
- Sends cancel `0xda` if the script aborts after `PrintStart` and before
  `PrintEnd`.

Physical result: pending. Ask the operator to confirm whether `CAPTURE`, `TEST`,
and `TOP LEFT` are readable, whether the filled square appears at the physical
top-left corner, and whether the small outlined square appears at the opposite
corner. Do not use this as the live-demo print path until that validation is
complete and the station can print real app-label content reliably.

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

Browser print and PNG import remain the supported live-demo profile. USB serial
detection plus diagnostic bitmap/glyph printing are confirmed progress for the
M2_H, but real app-label direct USB printing is not yet productized. Fill in the
print fields after both the NIIMBOT app test label and Capture This Coffee
browser/station test label print correctly:

- Printer model: NIIMBOT M2_H
- Connection: USB-C serial, `/dev/cu.usbmodem1101`
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
- Notes: USB identity query returned `#10001:V01.01,M2_H-I409130491,1*7C#`.
