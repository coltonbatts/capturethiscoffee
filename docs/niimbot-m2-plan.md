# Capture This Coffee — NIIMBOT M2 plan (June 30, 2026)

The direction is settled: keep the NIIMBOT M2, kill the laptop/print-station path, and make CTC a label-asset generator. What's left is undone groundwork — verify the printer against the app, get batch working in a way that survives a real shoot, and lock the label spec. This is that plan.

## What I verified about the M2

The M2 is a 300 DPI thermal-transfer printer (it uses a ribbon, not direct thermal). Its label width range is **20–50mm**, with an **effective printable width of ~48mm** and a minimum height of 9mm. So 50mm is the *widest* media it takes, and a 50mm-wide label only prints ~48mm of it — you lose ~1mm a side. The app's current export preset is **50×30mm @ 300 DPI = 591×354px**, with a 567px printable width. That width is sane against the 48mm printable spec. The 30mm height is along the feed direction, so it's flexible.

The one thing I can't confirm from a desk: **which roll/tape is actually loaded in your M2 right now.** 50×30mm is a believable guess, but you need to physically read the roll. That's a two-minute check, not a research project.

## The real batch decision (this is the crux)

CTC already does batch on its side — selecting multiple crew exports a PNG per cup and bundles them into the share sheet. The problem is the *other* side: the NIIMBOT app imports a custom image **one at a time**. Twenty cups = twenty manual imports. That's not a shoot-day workflow.

There are two honest paths, and they trade design control against speed:

**Path A — Image per cup (what's built now).** CTC renders a fully designed, on-brand PNG and you import each into the NIIMBOT app. Full creative control — this is the "brand moment" version. But batch is painful; realistically fine for a handful of VIP cups, not 25 crew drinks.

**Path B — CSV into NIIMBOT's batch template.** The NIIMBOT app natively supports **batch printing from Excel/CSV with variable-data templates** — you build one template in their editor, feed it a spreadsheet (name + drink), and print the whole run. Fast and built for exactly this. The catch: the design lives in NIIMBOT's template editor, so it's more constrained than your custom renderer — limited type and layout control.

The smart move for a designer who needs both: **CSV batch (Path B) for the bulk crew run, custom PNG (Path A) reserved for hero/client cups.** CTC already has the order data; adding a "Export CSV for NIIMBOT" button is a small, high-ROI change versus building any custom Bluetooth printing. You design one strong NIIMBOT template once and reuse it every shoot.

This is the decision to make on the physical printer, not on paper — print one of each and see what actually looks good on a lid.

## 30-minute bench test (do this next, with the M2 in hand)

1. Read the label roll currently loaded — note exact mm size and whether it's die-cut rectangles or continuous tape. Confirm or correct the 50×30mm assumption.
2. Open `/labels`, export one PNG, import it into the NIIMBOT app, print. Check: is it cropped, blurry, or the right size on an actual cup lid? Adjust the preset in `src/lib/niimbot-m2-preset.json` if needed.
3. Hand-build a quick NIIMBOT batch template from a 3-row test spreadsheet (name + drink) and print all three. Confirm the batch flow works on your phone and judge the design ceiling.
4. Compare A vs B side by side on real lids. Decide the split (likely B for crew, A for hero cups).
5. Test readability after a cold/condensation cup sits a few minutes — thermal transfer should hold, but confirm.

## Then the build (small, in priority order)

- **Lock the preset** in `niimbot-m2-preset.json` to the verified media. One-line change once you know the real size.
- **Add "Export CSV for NIIMBOT"** to `/labels` if Path B wins for crew — pull name + drink from the order data you already have.
- **Polish the custom label** (`coffee-label-renderer.tsx`) for the hero-cup path — this is your design surface and where the brand moment lives.
- Defer everything else (the access-control and dual-mode-data cleanup in the engineering brief) until printing actually works end to end. Don't let it block you.

## Open questions for you (not Luke)

- What roll is in the M2 right now? (Blocks the preset lock.)
- Is a CSV-batch + hero-cup split acceptable, or do you want every cup fully custom even if batch stays manual?
- Do you want the NIIMBOT batch template designed too, or is their default editor good enough for the crew run?
