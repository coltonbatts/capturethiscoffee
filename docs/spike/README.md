# Scan spike — module size and symbology

Decides, from a real print on real stock, whether printed labels can carry a
scannable code and at what module size. Nothing in the scan-code feature gets
built until this comes back.

Two sheets, printed in one sitting. Both are 591×354px, 300 DPI, 50×30mm.

- [`scan-spike-sheet-1.png`](scan-spike-sheet-1.png) — module size sweep.
  `node scripts/spike/render-spike-sheet.mjs`
- [`scan-spike-sheet-2.png`](scan-spike-sheet-2.png) — realistic QR against the
  actual deployment host. `node scripts/spike/render-spike-sheet-2.mjs`

## Sheet 1 — module size sweep

| | Symbology | Module | Footprint | Payload |
|---|---|---|---|---|
| **A** | Data Matrix ECC200 16×16 | 10 dots / 0.847mm | 180px / 15.24mm | `1000281474970001` |
| **B** | QR version 1, ECC M | 6 dots / 0.508mm | 174px / 14.73mm | `HTTP://CTC.CO/K3M9QX` |
| **C** | Data Matrix ECC200 16×16 | 8 dots / 0.677mm | 144px / 12.19mm | `1000281474970003` |
| **D** | Data Matrix ECC200 16×16 | 6 dots / 0.508mm | 108px / 9.14mm | `1000281474970004` |

**B vs D** isolates symbology at an identical 0.508mm module.
**A vs C vs D** isolates module size within one symbology.

B's host is not a real domain, so B understates a shippable QR — see sheet 2.

## Sheet 2 — realistic QR

| | Symbology | Module | Footprint | Payload |
|---|---|---|---|---|
| **E** | QR version 2, ECC M | 6 dots / 0.508mm | 198px / 16.76mm | `HTTPS://COFFEE.CAPTURETHIS.COM/K3M9QX` |
| **F** | Data Matrix ECC200 16×16 | 8 dots / 0.677mm | 144px / 12.19mm | `1000281474970005` |

**F repeats C exactly** (same symbology, symbol size and module size) as a
cross-print control: if F decodes but C did not, the difference is print
quality, not symbol design.

Footprints include the mandatory quiet zone — 4 modules per side for QR, 1 for
Data Matrix. That overhead is why QR is physically larger at a smaller module
size.

Each Data Matrix ends in a different digit so a scan reports which symbol
decoded: `…0001` = A, `…0003` = C, `…0004` = D, `…0005` = F. B and E are
self-identifying.

## Procedure

Data Matrix cannot be read by the stock iOS Camera app, and introducing a
third-party scanner would test a decoder the app will never use. So the test
photographs the printed cup and runs the photos through Apple's Vision
framework on the Mac — the same detector the CTC Printer app uses.

**This is stricter than live scanning.** A phone scanning in real time gets a
continuous stream of frames at varying angles, exposures and focus distances,
and succeeds if *any* frame decodes. A still photo gives the decoder exactly one
attempt. A symbol that passes here will comfortably pass live; a symbol that
fails here may still work in the app. Read failures as a caution, not a verdict.

1. Print both sheets on the holographic stock from the CTC Printer app, no
   scaling.
2. Wrap each on a real cup at the height labels normally sit.
3. Photograph with the iPhone — straight on and oblique, under set lighting and
   under deliberate glare, and after the cup has been handled. Several shots per
   condition. HEIC or JPEG, no need to convert.
4. Copy the photos to the Mac, then build the harness once:

```bash
swiftc -O tools/vision-barcode/main.swift -o /tmp/vision-barcode
```

5. Run it over every photo at once:

```bash
/tmp/vision-barcode ~/Desktop/spike-photos/*.HEIC
```

It accepts anything ImageIO reads — **HEIC and JPEG straight off an iPhone are
verified working**, alongside PNG — and applies EXIF orientation, so photos
taken in any device rotation are handled. Output is one JSON line per detection:

```
{"file":"IMG_0421.HEIC","symbology":"VNBarcodeSymbologyDataMatrix","payload":"1000281474970003"}
```

A photo with nothing detectable prints one line with `"symbology":"none"`, so
every input is accounted for.

6. Record, per symbol, the fraction of photos that decoded and under which
   conditions. The payload tail identifies the symbol.

## Results

_Pending physical test._

| Symbol | Photos decoded | Notes |
|---|---|---|
| A — DM 10 dots | | |
| B — QR V1 6 dots | | |
| C — DM 8 dots | | |
| D — DM 6 dots | | |
| E — QR V2 6 dots | | |
| F — DM 8 dots (control) | | |

## What the result decides

### The layout cliff at ~150px

The code sits bottom-right, bottom-aligned to the 18px safe margin, so a symbol
of side *S* has its top edge at y = 336 − *S*. The hero name descenders on the
code-carrying designs bottom out around y 171 (`grid-01`), 178 (`grid-02`) and
182 (`contact`). For the code to sit clear of the name, its top must be at
y ≥ ~186 — meaning **S ≤ 150px**.

| Symbol | Side | Clears the cliff? | Hero name width |
|---|---|---|---|
| C / F — DM 8 dots | 144px | **yes** | unchanged, 501px |
| A — DM 10 dots | 180px | no | capped ~317px |
| B — QR V1 6 dots | 174px | no | capped ~323px |
| E — QR V2 6 dots | 198px | no | capped ~297px |

Below the cliff the code only narrows the drink line and footer. Above it, the
name itself gets capped and the large-type treatment is gone on every design —
`grid-02` is worst hit, its 104px rail leaving only ~227px of text column.

### Does QR require buying a short domain?

**No — and buying one would not help.** The short domain moves QR from 198px to
174px, and both are above the 150px cliff, so no design decision changes.

QR's cost is structural, not payload-driven. Version 1 is the smallest QR that
exists: 21×21 modules plus a mandatory 4-module quiet zone on each side = 29
modules. At the 6-dot reliability floor that is 174px. **No QR configuration can
clear the 150px cliff at an acceptable module size, even with a one-character
domain.** Data Matrix clears it because its quiet zone is 1 module per side
instead of 4, and its symbol is 16 modules instead of 21.

So don't buy a domain for label geometry. If you want a short domain for humans
reading a URL, that's a separate and fine reason.

### Decision table

- **C and F decode reliably** → Data Matrix at 8 dots. Clean win: clears the
  cliff, hero names untouched, minimal layout work.
- **C fails, A decodes** → Data Matrix at 10 dots. Past the cliff, so hero names
  get capped on all six code-carrying designs.
- **E decodes and C does not** → QR at 6 dots, version 2, against the real host.
  Buys universal iPhone camera support at the cost of the cliff. Use HTTPS and
  the 6-character code — see below.
- **B decodes but E does not** → QR only works at version 1, which needs a short
  domain *and* a 4-character code. Weigh against Data Matrix before committing,
  since it is the only outcome where buying a domain changes anything.
- **Nothing decodes** → redesign the feature rather than build it.

### If QR wins: HTTPS and code length

Confirmed by direct encoding:

| Payload | Chars | Version | Footprint @ 6 dots |
|---|---|---|---|
| `HTTPS://COFFEE.CAPTURETHIS.COM/K3M9` | 35 | 2 | 198px |
| `HTTPS://COFFEE.CAPTURETHIS.COM/K3M9QX` | 37 | 2 | 198px |
| `HTTPS://CTC.CO/K3M9` | 19 | 1 | 174px |
| `HTTPS://CTC.CO/K3M9QX` | 21 | 2 | 198px |

HTTPS works — no need to print `http://` on a physical object. Against the real
host, a 4-character code and a 6-character code produce the **same version 2
symbol**, so the longer code is free and should be used.

That matters because the code is derived from the order UUID rather than
assigned, so collisions follow the birthday bound, not the raw keyspace. A
4-character code is 20 bits ≈ 1.05M combinations, but across a 300-order
production that is roughly a 4% chance of *some* collision and about 1 in 3,500
per individual scan. A 6-character code is 30 bits and drops per-scan ambiguity
to about 3 in ten million. Since it costs nothing here, use 6.

Short-domain QR is the only case where 4 characters buys anything: it is what
keeps `HTTPS://CTC.CO/K3M9` inside version 1's 20-character capacity.

## Encoders and harness

`scripts/spike/datamatrix.mjs` (ECC200 16×16, ASCII encodation) and
`scripts/spike/qr.mjs` (versions 1–2, ECC M, alphanumeric) are hand-rolled and
dependency-free. Both are verified against Apple's Vision framework by:

```bash
node scripts/spike/check-encoders.mjs
```

which builds `tools/vision-barcode/main.swift` and decodes the generated
symbols. Each render script re-runs that check against its finished sheet.

They stay under `scripts/spike/` until the physical result picks a symbology;
only the winner gets promoted into `src/lib` with tests.
