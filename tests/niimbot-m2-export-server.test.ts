import assert from "node:assert/strict";
import { describe, it } from "node:test";
import sharp from "sharp";
import type { CoffeeLabel } from "../src/lib/label-copy";
import { renderNiimbotM2LabelPngBuffer } from "../src/lib/niimbot-m2-export-server";
import { niimbotM2ExportPreset } from "../src/lib/niimbot-m2-draw";

describe("server NIIMBOT M2 PNG renderer", () => {
  it("renders name and drink ink on the text side of the label", async () => {
    const png = await renderNiimbotM2LabelPngBuffer(sampleLabel);
    const { data, info } = await sharp(png)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    assert.equal(info.width, niimbotM2ExportPreset.pixelWidth);
    assert.equal(info.height, niimbotM2ExportPreset.pixelHeight);
    assert.ok(
      countTextSideInk(data, info.width, info.height, info.channels) > 300,
      "expected visible name/drink ink on the right side of the label",
    );
  });
});

const sampleLabel: CoffeeLabel = {
  id: "order-test",
  personName: "Ava Stone",
  drink: "Iced Oat Latte",
  group: "Camera",
  productionClient: "Launch / Capture This",
  notesStatus: "Confirmed",
  orderId: "#TEST",
  title: "Ava Stone",
  bodyLines: ["Iced Oat Latte"],
  footerStart: "Camera #TEST",
  footerEnd: "Capture This Coffee",
  lines: [],
};

function countTextSideInk(
  data: Buffer,
  width: number,
  height: number,
  channels: number,
) {
  const startX = Math.round(width * 0.44);
  let count = 0;

  for (let y = 0; y < height; y += 1) {
    for (let x = startX; x < width; x += 1) {
      const offset = (y * width + x) * channels;
      const alpha = data[offset + 3];
      if (alpha === 0) continue;

      const luminance = (data[offset] + data[offset + 1] + data[offset + 2]) / 3;
      if (luminance < 180) count += 1;
    }
  }

  return count;
}
