# Capture This Coffee — NIIMBOT M2 plan (last updated July 1, 2026)

The direction is settled: keep the NIIMBOT M2, kill the laptop/print-station path, and make CTC a label-asset generator. What's left is undone groundwork — verify the printer against the app, get batch working in a way that survives a real shoot, and lock the label spec. This is that plan.

## What I verified about the M2 (from the spec sheet, not a physical print)

The M2 is a 300 DPI thermal-transfer printer (it uses a ribbon, not direct thermal). Its label width range is **20–50mm**, with an **effective printable width of ~48mm** and a minimum height of 9mm. So 50mm is the *widest* media it takes, and a 50mm-wide label only prints ~48mm of it — you lose ~1mm a side. The app's current export preset is **50×30mm @ 300 DPI = 591×354px**, with a 567px printable width. That width is sane against the 48mm printable spec. The 30mm height is along the feed direction, so it's flexible.

The one thing I can't confirm from a desk: **which roll/tape is actually loaded in your M2 right now.** 50×30mm is a believable guess, but you need to physically read the roll. That's a two-minute check, not a research project.

(Note: `niimbot-m2-preset.json`'s description was later edited to say this was "verified" the same day this plan was written — that didn't happen here or anywhere else recorded in the repo. The bench test below is still outstanding; run it via [docs/production-readiness-checklist.md](production-readiness-checklist.md) Section A.)

## The real batch decision (this is the crux)

CTC already does batch on its side — selecting multiple crew exports a PNG per cup and bundles them into the share sheet. The problem is the *other* side: the NIIMBOT app imports a custom image **one at a time**. Twenty cups = twenty manual imports.

There are two honest paths, and they trade design control against speed:

**Path A — Image per cup, then NIIMBOT's own Batch Print.** CTC renders a fully designed, on-brand PNG per person. You still import and save each one as a template in the NIIMBOT app's **My Templates** one at a time — no way around that part — but printing does not have to happen one-by-one. The app has a native **Batch Print** feature (Home → My Templates → Batch Print): multi-select several saved templates, set a copy count for each, and print the whole stack in one continuous pass. (Source: NIIMBOT in-app help doc, id 4166, "How to Use Batch Printing?" — fetched 2026-07-01.) Two caveats straight from that doc: don't mix label sizes in one batch (not an issue here, everything is 50×30mm), and **templates built from a data source are not eligible for this batch mode** — Path A and Path B don't merge.

This meaningfully changes Path A's ceiling. The old assumption was "20 cups = 20 full import-and-print cycles, hands-on the whole time." The real shape is "20 quick save-as-template actions, then 1 batch print job the PA can start and walk away from." Full creative control per person, and it may now be viable for the whole crew run, not just a handful of hero cups — pending how fast the save-as-template step actually is on set (see bench test below).

**Path B — CSV into NIIMBOT's batch template.** The NIIMBOT app natively supports **batch printing from Excel/CSV with variable-data templates** — you build one template in their editor, feed it a spreadsheet (name + drink), and print the whole run. Fast and built for exactly this. The catch: the design lives in NIIMBOT's template editor, so it's more constrained than your custom renderer — limited type and layout control, and no per-person artwork.

The decision now is less "which one for crew vs. hero" and more "does Path A's save-then-batch flow scale well enough to skip Path B entirely." That's a timing question, not a design one — answer it on the physical printer, not on paper. Print/save a handful of each and see which one a PA would actually tolerate doing 20+ times.

## 30-minute bench test (do this next, with the M2 in hand)

1. Read the label roll currently loaded — note exact mm size and whether it's die-cut rectangles or continuous tape. Confirm or correct the 50×30mm assumption.
2. Open `/labels`, export one PNG, import it into the NIIMBOT app, print. Check: is it cropped, blurry, or the right size on an actual cup lid? Adjust the preset in `src/lib/niimbot-m2-preset.json` if needed.
3. Hand-build a quick NIIMBOT batch template from a 3-row test spreadsheet (name + drink) and print all three. Confirm the batch flow works on your phone and judge the design ceiling.
4. Import 3-5 custom PNGs one at a time, saving each as a template in My Templates — time it per cup. Then open Batch Print, multi-select those saved templates, and print them in one pass. Confirm nothing gets mixed up (right label to right quantity) and note whether the save step is fast enough to do 20+ times on set.
5. Compare A (custom PNG + Batch Print) vs B (CSV template) side by side on real lids. Decide whether A's design quality is worth its extra save-per-cup time, or whether B's speed wins for the full crew run.
6. Test readability after a cold/condensation cup sits a few minutes — thermal transfer should hold, but confirm.

## Then the build (small, in priority order)

- **Lock the preset** in `niimbot-m2-preset.json` to the verified media. One-line change once you know the real size.
- **Add "Export CSV for NIIMBOT"** to `/labels` if Path B wins the timing test — pull name + drink from the order data you already have. Hold off building this until the bench test says you need it; don't build both paths speculatively.
- **Polish the custom label** (`coffee-label-renderer.tsx`) — if Path A's save-then-batch flow holds up at 20+ cups, this becomes the design surface for the *whole* crew run, not just hero cups.
- Defer everything else (the access-control and dual-mode-data cleanup in the engineering brief) until printing actually works end to end. Don't let it block you.

## Open questions for you (not Luke)

- What roll is in the M2 right now? (Blocks the preset lock.)
- Once you've timed the save-as-template step: is it fast enough to do fully custom labels for the whole crew, or does that still need a CSV/hero-cup split?
- Do you want the NIIMBOT batch template (Path B) designed too, as a fallback, or only build it if the bench test rules out Path A at scale?
