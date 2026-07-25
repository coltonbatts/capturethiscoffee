// Renders the server-side grid-01 label for the same fixtures the Flutter app
// golden-tests, and stacks each pair into one PNG for review.
//
// The app renders labels on device (mobile/lib/label_painter.dart) so it can
// print without a signal. That makes two renderers for one design, and the only
// thing keeping them honest is looking at them.
//
// Byte-identical output is NOT the goal and never will be: @napi-rs/canvas and
// Flutter's TextPainter shape and hint text differently. What must match is
// composition — the same lines break in the same places, nothing collides,
// nothing overflows the safe margin, and both fit 591x354.
//
// Usage:
//   node scripts/compare-label-renderers.mjs [outputDir]
//
// Regenerate the app side first:
//   (cd mobile && flutter test test/label_golden_test.dart --update-goldens)

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";
import { renderNiimbotM2LabelPngBuffer } from "../src/lib/niimbot-m2-export-server.ts";
import { buildCoffeeLabels, defaultLabelFields } from "../src/lib/label-copy.ts";

// Must stay in step with `_fixtures` in mobile/test/label_golden_test.dart.
const fixtures = [
  {
    golden: "grid-01-short-name",
    name: "Jordan Lee",
    drink: "Iced oat latte",
    group: "Camera",
    client: "Capture This",
  },
  {
    golden: "grid-01-long-name",
    name: "Alexandra Constantinopolous-Whitfield",
    drink: "Flat white",
    group: "Second Unit",
    client: "Capture This",
  },
  {
    golden: "grid-01-long-drink",
    name: "Sam Okafor",
    drink:
      "Large iced quad-shot oat milk latte, two pumps vanilla, light ice, extra hot lid",
    group: "Production",
    client: "Capture This",
  },
  { golden: "grid-01-minimal", name: "Al", drink: "Tea", group: "", client: "" },
];

const outputDir = process.argv[2] || join(process.cwd(), ".label-comparison");
const goldenDir = join(process.cwd(), "mobile", "test", "goldens", "labels");

await mkdir(outputDir, { recursive: true });

for (const fixture of fixtures) {
  const [label] = buildCoffeeLabels(
    { name: "Review Day" },
    fixture.client ? { name: fixture.client } : undefined,
    [
      {
        roster: {
          id: "roster-1",
          production_id: "prod-1",
          person_id: "person-1",
          group_label: fixture.group,
          on_set_today: true,
          sort_order: 1,
        },
        person: { id: "person-1", name: fixture.name, department: "" },
        // The queue sends an already-formatted drink string, so the fixture
        // puts it where formatDrink will pass it through unchanged.
        order: {
          id: "order-a1b2c3d4",
          status: "confirmed",
          drink_type: fixture.drink,
          size: "",
          temperature: "",
          milk_type: "",
          sweetener: "",
          caffeine: "Regular",
          special_notes: "",
        },
      },
    ],
    { style: "standard", fields: { ...defaultLabelFields, notesStatus: false } },
  );

  const serverPng = await renderNiimbotM2LabelPngBuffer(label, "grid-01");
  await writeFile(join(outputDir, `${fixture.golden}.server.png`), serverPng);

  const appPng = await readFile(join(goldenDir, `${fixture.golden}.png`));

  const gap = 16;
  const composite = await sharp({
    create: {
      width: 591,
      height: 354 * 2 + gap,
      channels: 3,
      background: { r: 220, g: 220, b: 220 },
    },
  })
    .composite([
      { input: serverPng, top: 0, left: 0 },
      { input: appPng, top: 354 + gap, left: 0 },
    ])
    .png()
    .toBuffer();

  await writeFile(join(outputDir, `${fixture.golden}.compare.png`), composite);
  console.log(`${fixture.golden}: server on top, app below`);
}

console.log(`\nWrote comparisons to ${outputDir}`);
