# Client print station handoff

This is the on-set label printing workflow for Capture This Coffee.

The short version: the website holds the work queue, and the printer laptop
prints the physical labels.

## What the system does

Capture This Coffee creates coffee orders and cup labels for a production.

When labels need to print, the hosted website keeps the master queue. The laptop
connected to the NIIMBOT printer opens the local station and prints from that
queue.

## Two places matter

### Master website

Use `https://coffee.capturethis.com` for productions, people, orders, and the
label queue.

This is the source of truth. It remembers what needs to print and what has
already printed.

### Printer laptop station

Use `http://localhost:3000/labels/station` on the laptop plugged into the
NIIMBOT.

This is the only place that should use USB printing. It talks to the printer
through the USB cable.

## On-set checklist

1. Plug in the NIIMBOT M2_H over USB and power it on.
2. Double-click `Start Print Station.command`.
3. Wait for the station page to open.
4. Wait for green readiness.
5. Use `http://localhost:3000/labels/station`.
6. Claim or select queued labels.
7. Click **Print via USB** for each label.
8. Confirm the physical label looks correct.
9. Mark the job printed only after the label is actually printed.
10. If USB printing fails, use browser print or **Download PNG** as the fallback.

## How to know it is working

- The Terminal window says it detected a NIIMBOT port.
- The known working port is `/dev/cu.usbmodem83201`.
- The station page shows green readiness.
- A test label prints from the station.
- The printer identity is `M2_H-I409130491`.
- The printer firmware is `1.50`.

## What not to do

- Do not try **Print via USB** from `https://coffee.capturethis.com`.
- Do not use browser Bluetooth status as proof that USB printing works.
- Do not put printer serial numbers into the hosted website settings.
- Do not mark a label printed until the physical label is correct.
- Do not move the USB cable to another laptop during a print run unless the
  station is restarted and checked again.

## If the printer is not detected

1. Make sure the NIIMBOT is powered on.
2. Make sure the USB cable is connected directly to the printer laptop.
3. Unplug and reconnect the USB cable.
4. Close the Terminal window from the launcher.
5. Double-click `Start Print Station.command` again.
6. Look for `/dev/cu.usbmodem83201` in the Terminal message.

Call Colton or the tech lead if the launcher still cannot find the printer.

## If port 3000 is already in use

The launcher is designed to reuse the local station if it is already running.

If the station page opens and readiness is green, keep going.

If the page does not open, close old Terminal windows for Capture This Coffee
and double-click `Start Print Station.command` again.

Call Colton or the tech lead if the launcher keeps reporting a port problem.

## If the station opens but readiness is not green

1. Wait a few seconds. The station may still be checking the printer.
2. Refresh `http://localhost:3000/labels/station`.
3. Confirm the printer is powered on and connected by USB.
4. Restart with `Start Print Station.command`.

If readiness is still not green, switch to browser print or **Download PNG** so
the set can keep moving.

Call Colton or the tech lead after switching to the fallback.

## If USB print fails mid-set

Do not stop the coffee workflow.

1. Keep the label selected on the station page.
2. Try **Print via USB** one more time.
3. If it fails again, use browser print.
4. If browser print is not available, click **Download PNG** and print the PNG
   through the NIIMBOT desktop app.
5. Mark the job printed only after the physical label is correct.

Call Colton or the tech lead if more than one or two labels fail by USB.

## Browser print fallback

Use this when USB printing is not ready but the printer is available in the
normal print dialog.

1. Open the label on `http://localhost:3000/labels/station`.
2. Use the browser print option.
3. Choose the NIIMBOT printer or NIIMBOT print target.
4. Print one label.
5. Confirm the physical label is correct.
6. Mark the job printed.

## Download PNG fallback

Use this when USB printing and browser print are not working.

1. Open the label on `http://localhost:3000/labels/station`.
2. Click **Download PNG**.
3. Open the downloaded PNG in the NIIMBOT desktop app.
4. Print from the NIIMBOT app.
5. Confirm the physical label is correct.
6. Mark the job printed.

## When to call Colton or the tech lead

Call if:

- The launcher cannot detect the NIIMBOT.
- Green readiness never appears.
- The printer feeds blank labels.
- Labels print cut off, sideways, or unreadable.
- USB print fails repeatedly.
- The hosted website queue does not match the station queue.
- Anyone is about to change hosted settings or environment variables.

