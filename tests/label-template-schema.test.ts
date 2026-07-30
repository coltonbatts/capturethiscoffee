import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createCanvas } from "@napi-rs/canvas";
import {
  bundledLabelTemplateCatalog,
  bundledLabelTemplates,
} from "../src/lib/label-template-catalog";
import {
  fitLabelTemplateText,
  drawNiimbotM2Label,
} from "../src/lib/niimbot-m2-draw";
import {
  validateLabelTemplateCatalog,
  validateLabelTemplateDefinition,
  type LabelTextElement,
} from "../src/lib/label-template-schema";
import type { CoffeeLabel } from "../src/lib/label-copy";

const longNameLabel: CoffeeLabel = {
  id: "long-name",
  personName: "Cameron Ellington-Smythe",
  drink: "Iced oat latte, half sweet",
  group: "Camera",
  productionClient: "Morning Unit / Studio",
  notesStatus: "",
  orderId: "#B13",
  title: "Cameron Ellington-Smythe",
  bodyLines: ["Iced oat latte, half sweet"],
  footerStart: "",
  footerEnd: "",
  lines: [],
};

test("canonical catalog contains eight strict 591x354 declarative templates", () => {
  const result = validateLabelTemplateCatalog(bundledLabelTemplateCatalog);
  assert.equal(result.ok, true);
  assert.equal(bundledLabelTemplates.length, 8);
  assert.deepEqual(
    bundledLabelTemplates.map((template) => template.id),
    [
      "grid-01",
      "grid-02",
      "instrument",
      "contact",
      "caption",
      "block",
      "halo",
      "orbit",
    ],
  );
});

test("validator rejects overlapping line metrics and remote content", () => {
  const definition = structuredClone(bundledLabelTemplates[0].definition);
  const text = definition.elements.find(
    (element): element is LabelTextElement => element.type === "text",
  );
  assert.ok(text);
  text.lineHeight = text.fontSize - 1;
  text.segments = [{ literal: "https://example.com/template.js" }];
  const result = validateLabelTemplateDefinition(definition);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.match(result.errors.join(" "), /lineHeight must be at least fontSize/);
    assert.match(result.errors.join(" "), /remote content/);
  }
});

test("long names fit without overlapping lines in every bundled renderer", () => {
  const canvas = createCanvas(591, 354);
  const context = canvas.getContext("2d");
  for (const template of bundledLabelTemplates) {
    const nameElement = template.definition.elements.find(
      (element): element is LabelTextElement =>
        element.type === "text" &&
        element.segments.some(
          (segment) =>
            "binding" in segment && segment.binding === "personName",
        ),
    );
    assert.ok(nameElement, `${template.id} has a personName element`);
    const layout = fitLabelTemplateText(
      context as unknown as CanvasRenderingContext2D,
      nameElement,
      longNameLabel.personName.toUpperCase(),
    );
    assert.ok(layout.lines.length >= 1, `${template.id} renders the long name`);
    assert.ok(
      layout.lines.length <= nameElement.maxLines,
      `${template.id} respects maxLines`,
    );
    assert.ok(
      layout.lineHeight >= layout.fontSize,
      `${template.id} lines cannot overlap`,
    );
    assert.ok(
      layout.fontSize +
        (layout.lines.length - 1) * layout.lineHeight <=
        nameElement.height,
      `${template.id} stays inside its text box`,
    );
    drawNiimbotM2Label(
      context as unknown as CanvasRenderingContext2D,
      longNameLabel,
      template.definition,
    );
  }
});

test("template administration confirms irreversible publish and default changes", async () => {
  const source = await readFile(
    new URL(
      "../src/app/labels/templates/template-workspace-client.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(source, /Publish .*Published versions are immutable/);
  assert.match(
    source,
    /Make .* the default for future days\? Existing days keep their current snapshot/,
  );
  assert.ok(
    (source.match(/window\.confirm\(/g) || []).length >= 2,
    "publish and default changes both require confirmation",
  );
});
