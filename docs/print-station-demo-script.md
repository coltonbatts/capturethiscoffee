# Print station demo script

Use this for a 3 to 5 minute walkthrough with Luke.

## 1. Show the master website

Open `https://coffee.capturethis.com`.

Explain:

- This is where productions and orders live.
- This is the master queue.
- The hosted website does not physically control the USB printer.

## 2. Show the local launcher

On the printer laptop, double-click `Start Print Station.command`.

Point out:

- A Terminal window opens.
- It detects the NIIMBOT USB port.
- The known working port is `/dev/cu.usbmodem83201`.
- The station page opens automatically.

## 3. Show green readiness

Open `http://localhost:3000/labels/station`.

Explain:

- Green readiness means this laptop can reach the local print station.
- This is the page to use for physical USB printing.
- Browser Bluetooth status is separate and does not prove USB printing works.

## 4. Print one test label

Queue or select one label.

Then:

1. Click **Print via USB**.
2. Wait for the physical label.
3. Check that it looks correct.
4. Mark it printed.

Explain that the job should only be marked printed after the label is physically
correct.

## 5. Explain the fallback

If USB printing fails during the day:

1. Try **Print via USB** one more time.
2. Use browser print if it is available.
3. Use **Download PNG** if browser print is not available.
4. Print the PNG from the NIIMBOT desktop app.
5. Call Colton or the tech lead if failures continue.

Close by repeating the split:

- `coffee.capturethis.com` is the master website and queue.
- `http://localhost:3000/labels/station` on the printer laptop is the physical
  print station.

