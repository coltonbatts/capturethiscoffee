#!/usr/bin/env node

import { promises as fs } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  NiimbotHeadlessSerialClient,
} = require("@mmote/niimblue-node");
const { SerialPort } = require("serialport");
const {
  HeartbeatType,
  LabelType,
  PacketGenerator,
  RequestCommandId,
  ResponseCommandId,
  Utils,
} = require("@mmote/niimbluelib");

const niimblueNodePackage = require("@mmote/niimblue-node/package.json");
const niimblueLibPackage = require("@mmote/niimbluelib/package.json");

const defaultPortPrefix = "/dev/cu.usbmodem";
const niimbotVendorId = "3513";
const niimbotProductId = "0002";
const labelRows = 354;
const printheadColumns = 567;
const bytesPerRow = Math.ceil(printheadColumns / 8);
const density = 3;
const labelType = LabelType.WithGaps;
const totalPages = 1;
const statusPollIntervalMs = 500;
const statusTimeoutMs = 30_000;
const pageTimeoutMs = 20_000;

const requestedPort = process.argv.find((arg) => arg.startsWith("/dev/"));
const confirmed = process.argv.includes("--yes");
const debug = process.argv.includes("--debug");

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

async function main() {
  if (!confirmed) {
    console.error(
      "Refusing to print without --yes. This consumes one RFID-tagged NIIMBOT label.",
    );
    console.error(
      "Usage: npm run niimbot:print-raster-spike -- --yes [/dev/cu.usbmodem101] [--debug]",
    );
    return;
  }

  const ports = await findUsbModemPorts();
  const niimbotPorts = await findNiimbotSerialPorts();
  const port = requestedPort || niimbotPorts[0]?.path;

  console.log("NIIMBOT M2_H USB raster spike");
  console.log(`Dependencies: @mmote/niimblue-node ${niimblueNodePackage.version}, @mmote/niimbluelib ${niimblueLibPackage.version}`);
  console.log(`Raster: ${printheadColumns} x ${labelRows}, ${bytesPerRow} bytes/row, 1bpp MSB-first, 1=black`);
  console.log(`Print task: B1, direction top, density ${density}, label type ${labelType}, copies 1`);
  console.log("Pre-flight: printer ON, USB serial connected, valid RFID-tagged 50x30mm NIIMBOT label/ribbon loaded.");
  console.log("");

  if (ports.length) {
    console.log("Detected USB modem serial devices:");
    for (const detectedPort of ports) console.log(`- ${detectedPort}`);
  } else {
    console.log(`No ${defaultPortPrefix}* devices were detected.`);
  }

  if (niimbotPorts.length) {
    console.log("");
    console.log(`Detected NIIMBOT ${niimbotVendorId}:${niimbotProductId} serial devices:`);
    for (const item of niimbotPorts) console.log(`- ${item.path} (${item.manufacturer || "unknown manufacturer"})`);
  } else {
    console.log("");
    console.log(`No NIIMBOT ${niimbotVendorId}:${niimbotProductId} serial devices were detected by serialport metadata.`);
  }

  if (!port) {
    console.log("");
    console.log("Connect the NIIMBOT over USB-C, power it on, then retry.");
    console.log("If macOS lists the printer but metadata is unavailable, pass the exact /dev/cu.usbmodem* path explicitly.");
    return;
  }

  const client = new NiimbotHeadlessSerialClient();
  client.setPort(port);
  client.setDebug(debug);
  wireLogging(client);

  let printStarted = false;
  let printEnded = false;

  try {
    console.log("");
    console.log(`Opening ${port}`);
    const connection = await client.connect();
    console.log("Connection:", JSON.stringify(connection));
    console.log("PrinterInfo:", JSON.stringify(client.getPrinterInfo()));
    console.log("Model metadata:", JSON.stringify(client.getModelMetadata()));
    console.log("Detected print task:", client.getPrintTaskType());

    const [softwareVersion, hardwareVersion] = await Promise.allSettled([
      client.abstraction.getSoftwareVersion(),
      client.abstraction.getHardwareVersion(),
    ]);
    console.log("Software version:", settledValue(softwareVersion));
    console.log("Hardware version:", settledValue(hardwareVersion));

    assertM2hMetadata(client);

    console.log("");
    console.log("Heartbeat before print");
    const heartbeat = await client.abstraction.heartbeat();
    console.log("Heartbeat:", JSON.stringify(heartbeat));

    const encodedImage = buildSpikeImage();
    const printTask = client.abstraction.newPrintTask("B1", {
      density,
      labelType,
      totalPages,
      statusPollIntervalMs,
      statusTimeoutMs,
      pageTimeoutMs,
      color: 0,
    });

    console.log("");
    console.log("B1 print init");
    await printTask.printInit();
    printStarted = true;

    console.log("B1 page stream");
    await printTask.printPage(encodedImage, 1);

    console.log("Polling PrintStatus until printProgress=100 and feedProgress=100");
    await withTimeout(
      printTask.waitForFinished(),
      statusTimeoutMs + 5_000,
      "Timed out waiting for PrintStatus completion.",
    );

    console.log("PrintEnd after confirmed completion");
    const ended = await printTask.printEnd();
    printEnded = ended;
    console.log(`PrintEnd accepted: ${ended}`);

    console.log("Heartbeat final");
    await client.abstraction.send(PacketGenerator.heartbeat(HeartbeatType.Advanced1), 1_000);
    console.log("Raster spike complete. Re-run this command to verify repeat printing without a power cycle.");
  } catch (error) {
    if (client.isConnected() && printStarted && !printEnded) {
      await cancelAfterAbort(client, error);
    }
    throw error;
  } finally {
    await client.disconnect().catch(() => {});
    console.log("Serial handle closed.");
  }
}

function buildSpikeImage() {
  const rows = Array.from({ length: labelRows }, () => Buffer.alloc(bytesPerRow, 0x00));

  drawRect(rows, 18, 18, 531, 318, 3);
  drawText(rows, "CAPTURE", 52, 54, 8);
  drawText(rows, "M2H 567", 52, 132, 6);
  drawText(rows, "TOP LEFT", 52, 218, 5);
  fillRect(rows, 510, 286, 24, 24);

  const rowsData = [];
  let row = 0;
  while (row < labelRows) {
    const rowData = rows[row];
    const dataType = rowData.some((byte) => byte !== 0x00) ? "pixels" : "void";
    let repeat = 1;
    while (row + repeat < labelRows) {
      const next = rows[row + repeat];
      const nextType = next.some((byte) => byte !== 0x00) ? "pixels" : "void";
      if (nextType !== dataType) break;
      if (dataType === "pixels" && !rowData.equals(next)) break;
      repeat += 1;
    }

    rowsData.push({
      dataType,
      rowNumber: row,
      repeat,
      blackPixelsCount: dataType === "pixels" ? countBlackPixels(rowData) : 0,
      rowData: dataType === "pixels" ? new Uint8Array(rowData) : undefined,
    });
    row += repeat;
  }

  const bitmapRows = rowsData.filter((item) => item.dataType === "pixels").length;
  const emptyRuns = rowsData.filter((item) => item.dataType === "void").length;
  console.log(`Encoded rows: ${rowsData.length} runs (${bitmapRows} bitmap, ${emptyRuns} empty).`);

  return {
    cols: printheadColumns,
    rows: labelRows,
    rowsData,
  };
}

const glyphs = {
  " ": ["000", "000", "000", "000", "000", "000", "000"],
  "2": ["1110", "0001", "0001", "0110", "1000", "1000", "1111"],
  "5": ["1111", "1000", "1000", "1110", "0001", "0001", "1110"],
  "6": ["0111", "1000", "1000", "1110", "1001", "1001", "0110"],
  "7": ["1111", "0001", "0010", "0010", "0100", "0100", "0100"],
  A: ["0110", "1001", "1001", "1111", "1001", "1001", "1001"],
  C: ["0111", "1000", "1000", "1000", "1000", "1000", "0111"],
  E: ["1111", "1000", "1000", "1110", "1000", "1000", "1111"],
  F: ["1111", "1000", "1000", "1110", "1000", "1000", "1000"],
  H: ["1001", "1001", "1001", "1111", "1001", "1001", "1001"],
  L: ["1000", "1000", "1000", "1000", "1000", "1000", "1111"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  O: ["0110", "1001", "1001", "1001", "1001", "1001", "0110"],
  P: ["1110", "1001", "1001", "1110", "1000", "1000", "1000"],
  R: ["1110", "1001", "1001", "1110", "1100", "1010", "1001"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["1001", "1001", "1001", "1001", "1001", "1001", "0110"],
};

function drawText(canvas, text, x, y, scale) {
  let cursorX = x;
  for (const char of text) {
    const glyph = glyphs[char];
    if (!glyph) throw new Error(`No spike glyph defined for ${char}`);
    drawGlyph(canvas, glyph, cursorX, y, scale);
    cursorX += (glyph[0].length + 1) * scale;
  }
}

function drawGlyph(canvas, glyph, x, y, scale) {
  for (let row = 0; row < glyph.length; row += 1) {
    for (let column = 0; column < glyph[row].length; column += 1) {
      if (glyph[row][column] === "1") {
        fillRect(canvas, x + column * scale, y + row * scale, scale, scale);
      }
    }
  }
}

function drawRect(canvas, x, y, width, height, thickness) {
  fillRect(canvas, x, y, width, thickness);
  fillRect(canvas, x, y + height - thickness, width, thickness);
  fillRect(canvas, x, y, thickness, height);
  fillRect(canvas, x + width - thickness, y, thickness, height);
}

function fillRect(canvas, x, y, width, height) {
  for (let row = y; row < y + height; row += 1) {
    if (row < 0 || row >= labelRows) continue;
    for (let column = x; column < x + width; column += 1) {
      setPixel(canvas[row], column);
    }
  }
}

function setPixel(rowBytes, column) {
  if (column < 0 || column >= printheadColumns) return;
  rowBytes[Math.floor(column / 8)] |= 0x80 >> (column % 8);
}

function countBlackPixels(rowBytes) {
  let count = 0;
  for (const byte of rowBytes) count += bitCounts[byte];
  return count;
}

const bitCounts = Array.from({ length: 256 }, (_, value) => {
  let count = 0;
  for (let bit = 0; bit < 8; bit += 1) {
    if (value & (1 << bit)) count += 1;
  }
  return count;
});

async function cancelAfterAbort(client, originalError) {
  const message = originalError instanceof Error ? originalError.message : String(originalError);
  console.error(`Print aborted before PrintEnd: ${message}`);
  console.error("Sending CancelPrint cleanup.");
  try {
    await client.abstraction.send(PacketGenerator.mapped(RequestCommandId.CancelPrint), 1_500);
  } catch (cancelError) {
    const cancelMessage = cancelError instanceof Error ? cancelError.message : String(cancelError);
    console.error(`CancelPrint cleanup failed: ${cancelMessage}`);
  }
}

function assertM2hMetadata(client) {
  const info = client.getPrinterInfo();
  const metadata = client.getModelMetadata();
  const detectedTask = client.getPrintTaskType();

  if (metadata?.printheadPixels !== printheadColumns) {
    throw new Error(`Expected M2_H printhead ${printheadColumns}px, got ${metadata?.printheadPixels ?? "unknown"}.`);
  }
  if (metadata?.dpi !== 300) {
    throw new Error(`Expected M2_H 300 DPI, got ${metadata?.dpi ?? "unknown"}.`);
  }
  if (metadata?.printDirection !== "top") {
    throw new Error(`Expected M2_H print direction top, got ${metadata?.printDirection ?? "unknown"}.`);
  }
  if (detectedTask !== "B1") {
    throw new Error(`Expected detected B1 print task for model ${info.model ?? "unknown"}, got ${detectedTask ?? "unknown"}.`);
  }
}

function wireLogging(client) {
  client.on("printprogress", (event) => {
    console.log(
      `PrintStatus: page=${event.page}/${event.pagesTotal} printProgress=${event.pagePrintProgress} feedProgress=${event.pageFeedProgress}`,
    );
  });
  client.on("packetsent", (event) => {
    const name = RequestCommandId[event.packet.command] || hexId(event.packet.command);
    console.log(`> ${name} ${Utils.bufToHex(event.packet.toBytes())}`);
  });
  client.on("packetreceived", (event) => {
    const name = ResponseCommandId[event.packet.command] || hexId(event.packet.command);
    console.log(`< ${name} ${Utils.bufToHex(event.packet.toBytes())}`);
  });
  client.on("heartbeatfailed", (event) => {
    console.warn(`Heartbeat failed ${event.failedAttempts}`);
  });
  client.on("disconnect", () => {
    console.log("Printer disconnected.");
  });
}

async function findUsbModemPorts() {
  const entries = await fs.readdir("/dev");
  return entries
    .filter((entry) => entry.startsWith("cu.usbmodem"))
    .sort()
    .map((entry) => `/dev/${entry}`);
}

async function findNiimbotSerialPorts() {
  const ports = await SerialPort.list();
  return ports
    .filter((port) => {
      const vendorId = port.vendorId?.toLowerCase().padStart(4, "0");
      const productId = port.productId?.toLowerCase().padStart(4, "0");
      return vendorId === niimbotVendorId && productId === niimbotProductId;
    })
    .sort((a, b) => a.path.localeCompare(b.path));
}

function withTimeout(promise, timeoutMs, message) {
  let timeout;
  return Promise.race([
    promise.finally(() => clearTimeout(timeout)),
    new Promise((_, reject) => {
      timeout = setTimeout(() => reject(new Error(message)), timeoutMs);
    }),
  ]);
}

function settledValue(result) {
  if (result.status === "fulfilled") return result.value;
  return `unavailable (${result.reason instanceof Error ? result.reason.message : String(result.reason)})`;
}

function hexId(value) {
  return `0x${value.toString(16).padStart(2, "0")}`;
}
