# Print station quick start

Use this on the printer laptop.

## Start

- [ ] Plug in the NIIMBOT M2_H with USB.
- [ ] Power on the printer.
- [ ] Double-click `Start Print Station.command`.
- [ ] Wait for the station page to open.
- [ ] Confirm readiness is green.
- [ ] Use `http://localhost:3000/labels/station`.

## Print

- [ ] Select or claim the next queued label.
- [ ] Click **Print via USB**.
- [ ] Check the physical label.
- [ ] Mark printed only after the label is correct.
- [ ] Continue with the next label.

## Good signs

- [ ] Terminal says it detected the NIIMBOT port.
- [ ] Port shows `/dev/cu.usbmodem83201`.
- [ ] Station readiness is green.
- [ ] A test label prints.

## Do not

- [ ] Do not USB print from `https://coffee.capturethis.com`.
- [ ] Do not treat Bluetooth status as USB readiness.
- [ ] Do not add printer serial numbers to hosted settings.
- [ ] Do not mark printed before the label is physically correct.

## Fallback

If USB printing fails:

- [ ] Try **Print via USB** one more time.
- [ ] Use browser print if available.
- [ ] Use **Download PNG** if browser print is not available.
- [ ] Print the PNG in the NIIMBOT desktop app.
- [ ] Call Colton or the tech lead if failures continue.

