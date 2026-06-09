#!/usr/bin/env node

import { promises as fs } from "node:fs";
import { createRequire } from "node:module";
import sharp from "sharp";

const require = createRequire(import.meta.url);
const { NiimbotHeadlessSerialClient } = require("@mmote/niimblue-node");
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

const niimbotVendorId = "3513";
const niimbotProductId = "0002";
const printheadColumns = 567;
const labelRows = 354;
const bytesPerRow = Math.ceil(printheadColumns / 8);
const sourceColumns = 591;
const density = 3;
const labelType = LabelType.WithGaps;
const totalPages = 1;
const statusPollIntervalMs = 500;
const statusTimeoutMs = 30_000;
const pageTimeoutMs = 20_000;

const cliPort = process.argv.find((arg) => arg.startsWith("/dev/"));
const jobIdArg = process.argv.find((arg) => arg.startsWith("--job-id="));
const requestedJobId = jobIdArg?.split("=")[1]?.trim() || "";
const renderSample = process.argv.includes("--render-sample");
const debug = process.argv.includes("--debug");
const once = process.argv.includes("--once");
const dryRun = process.argv.includes("--dry-run");
const pollMs = positiveInteger(env("LABEL_SERIAL_POLL_MS"), 3_500);
const apiBaseUrl = stripTrailingSlash(
  env("LABEL_SERIAL_API_BASE_URL") ||
    env("NEXT_PUBLIC_APP_URL") ||
    "http://localhost:3000",
);
const bearerToken =
  env("LABEL_SERIAL_AUTH_TOKEN") ||
  env("PRINT_STATION_AUTH_TOKEN") ||
  env("SUPABASE_ACCESS_TOKEN") ||
  (env("PRINT_STATION_YOLO") === "true" || env("LABEL_SERIAL_YOLO") === "true"
    ? "print-station-yolo"
    : "");
const requestedPort = cliPort || env("LABEL_SERIAL_PORT") || env("NIIMBOT_PORT");

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
});

async function main() {
  if (renderSample) {
    await renderSampleRaster();
    return;
  }

  if (!bearerToken) {
    throw new Error(
      "Missing LABEL_SERIAL_AUTH_TOKEN. Use a Supabase access token for an authenticated app user.",
    );
  }

  const portInfo = await resolvePrinterPort();
  console.log("Capture This Coffee NIIMBOT serial worker");
  console.log(`API: ${apiBaseUrl}`);
  console.log(`Dependencies: @mmote/niimblue-node ${niimblueNodePackage.version}, @mmote/niimbluelib ${niimblueLibPackage.version}`);
  console.log(`Raster: ${printheadColumns} x ${labelRows}, ${bytesPerRow} bytes/row, 1bpp MSB-first, 1=black`);
  console.log(`Print task: B1, direction top, density ${density}, label type ${labelType}, copies 1`);
  console.log(`Printer port: ${portInfo.path}`);
  console.log(`Printer USB: ${portInfo.vendorId || "unknown"}:${portInfo.productId || "unknown"}`);
  if (dryRun) console.log("Dry run: jobs will be claimed and rendered but not printed or completed.");

  let shouldStop = false;
  process.on("SIGINT", () => {
    shouldStop = true;
    console.log("Stopping after current poll.");
  });
  process.on("SIGTERM", () => {
    shouldStop = true;
    console.log("Stopping after current poll.");
  });

  do {
    const printed = await processNextJob(portInfo).catch(async (error) => {
      console.error(error instanceof Error ? error.message : String(error));
      return false;
    });
    if (once) {
      if (requestedJobId && !printed) process.exitCode = 1;
      break;
    }
    if (!printed && !shouldStop) await sleep(pollMs);
  } while (!shouldStop);
}

async function processNextJob(portInfo) {
  const job = requestedJobId
    ? await fetchRequestedJob(requestedJobId)
    : (await apiFetch(`/api/print-jobs?status=queued&limit=1`)).jobs?.[0];
  if (!job) {
    console.log("No queued labels.");
    return false;
  }

  console.log(`Preparing job ${job.id} (${jobTitle(job)})`);
  let claimed;
  try {
    claimed = await prepareJob(job);
  } catch (error) {
    if (httpStatus(error) === 409) {
      console.log(`Job ${job.id} was claimed elsewhere.`);
      return false;
    }
    throw error;
  }

  const attempt = await createAttempt(claimed, portInfo, "started");
  console.log(`Started attempt ${attempt.id}`);

  try {
    const encodedImage = await renderJobRaster(claimed);
    console.log(`Rendered job ${claimed.id}: ${encodedImage.rowsData.length} row runs.`);

    if (dryRun) {
      console.log(`Dry run rendered ${claimed.id}; leaving job ${claimed.status} for manual handling.`);
      return true;
    }

    await printRaster(portInfo.path, encodedImage);
    await apiFetch(`/api/print-jobs/${claimed.id}/complete`, {
      method: "POST",
      body: JSON.stringify({ attempt_id: attempt.id }),
    });
    console.log(`Completed job ${claimed.id} (${jobTitle(claimed)})`);
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Job ${claimed.id} failed: ${message}`);
    await createAttempt(claimed, portInfo, "failed", message).catch((attemptError) => {
      console.error(`Could not record failed attempt: ${attemptError.message}`);
    });
    await apiFetch(`/api/print-jobs/${claimed.id}/fail`, {
      method: "POST",
      body: JSON.stringify({
        release: false,
        error_message: message,
      }),
    }).catch((failError) => {
      console.error(`Could not mark job failed: ${failError.message}`);
    });
    return false;
  }
}

async function fetchRequestedJob(jobId) {
  const candidates = [];
  for (const status of ["queued", "claimed", "printing"]) {
    const body = await apiFetch(`/api/print-jobs?status=${status}&limit=100`);
    candidates.push(...(body.jobs || []));
  }
  const job = candidates.find((candidate) => candidate.id === jobId);
  if (!job) throw new Error(`Selected job ${jobId} is not queued, claimed, or printing.`);
  return job;
}

async function prepareJob(job) {
  if (job.status === "queued") {
    console.log(`Claiming job ${job.id}`);
    return (await apiFetch(`/api/print-jobs/${job.id}/claim`, { method: "POST" })).job;
  }
  if (job.status === "claimed" || job.status === "printing") {
    console.log(`Using already ${job.status} job ${job.id}`);
    return job;
  }
  throw new Error(`Job ${job.id} is ${job.status}; only queued, claimed, or printing jobs can be printed.`);
}

async function printRaster(port, encodedImage) {
  const client = new NiimbotHeadlessSerialClient();
  client.setPort(port);
  client.setDebug(debug);
  wireLogging(client);

  let printStarted = false;
  let printEnded = false;

  try {
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

    console.log("Heartbeat before print");
    const heartbeat = await client.abstraction.heartbeat();
    console.log("Heartbeat:", JSON.stringify(heartbeat));

    const printTask = client.abstraction.newPrintTask("B1", {
      density,
      labelType,
      totalPages,
      statusPollIntervalMs,
      statusTimeoutMs,
      pageTimeoutMs,
      color: 0,
    });

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
    if (!ended) throw new Error("PrintEnd was not accepted.");
    console.log("PrintEnd accepted: true");

    console.log("Heartbeat final");
    await client.abstraction.send(PacketGenerator.heartbeat(HeartbeatType.Advanced1), 1_000);
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

async function renderJobRaster(job) {
  const payload = job.payload;
  if (!isPayloadV1(payload)) throw new Error("Print job payload is not label payload v1.");

  try {
    return await renderJobRasterFromSvg(payload.label);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`SVG raster render failed; falling back to block raster: ${message}`);
    return renderJobRasterFallback(payload.label);
  }
}

async function renderJobRasterFromSvg(label) {
  const svg = renderLabelSvg(label);
  const image = await sharp(Buffer.from(svg))
    .resize(printheadColumns, labelRows, {
      fit: "fill",
      kernel: "lanczos3",
    })
    .grayscale()
    .threshold(178)
    .raw()
    .toBuffer();
  const rows = Array.from({ length: labelRows }, (_, row) => {
    const rowBytes = Buffer.alloc(bytesPerRow, 0x00);
    for (let column = 0; column < printheadColumns; column += 1) {
      const pixel = image[row * printheadColumns + column];
      if (pixel < 128) setPixel(rowBytes, column);
    }
    return rowBytes;
  });

  return encodeRows(rows);
}

function renderLabelSvg(label) {
  const main = label.title || label.personName || "Cup label";
  const body = label.bodyLines?.join(" / ") || label.drink || "";
  const titleLines = wrapSvgText(main, 25, 2);
  const bodyLines = wrapSvgText(body, 35, 3);
  const footerStart = ellipsize(label.footerStart || label.group || "", 21);
  const footerEnd = ellipsize(label.footerEnd || label.productionClient || "", 36);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${sourceColumns}" height="${labelRows}" viewBox="0 0 ${sourceColumns} ${labelRows}">
  <rect width="100%" height="100%" fill="#fff"/>
  <rect x="18" y="18" width="555" height="318" fill="none" stroke="#000" stroke-width="4"/>
  <rect x="42" y="42" width="80" height="80" fill="none" stroke="#000" stroke-width="4"/>
  <g transform="translate(82 82) rotate(-45)" stroke="#000" stroke-width="7" stroke-linecap="square">
    <path d="M-24 0H24M0 -24V24"/>
  </g>
  <text x="146" y="48" fill="#000" font-family="Arial, Helvetica, sans-serif" font-size="39" font-weight="900" dominant-baseline="hanging">${svgTspans(titleLines, 146, 48, 42)}</text>
  <text x="42" y="154" fill="#000" font-family="Arial, Helvetica, sans-serif" font-size="28" font-weight="900" dominant-baseline="hanging">${svgTspans(bodyLines, 42, 154, 34)}</text>
  <line x1="42" y1="282" x2="550" y2="282" stroke="#000" stroke-width="3"/>
  <text x="42" y="303" fill="#000" font-family="Arial, Helvetica, sans-serif" font-size="17" font-weight="900" dominant-baseline="hanging">${escapeXml(footerStart)}</text>
  <text x="250" y="303" fill="#000" font-family="Arial, Helvetica, sans-serif" font-size="17" font-weight="900" dominant-baseline="hanging">${escapeXml(footerEnd)}</text>
</svg>`;
}

function svgTspans(lines, x, y, lineHeight) {
  return lines
    .map((line, index) => {
      return `<tspan x="${x}" y="${y + lineHeight * index}">${escapeXml(line)}</tspan>`;
    })
    .join("");
}

function wrapSvgText(text, maxChars, maxLines) {
  const words = normalizeReadableText(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";

  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length <= maxChars || !line) {
      line = next;
      continue;
    }
    lines.push(line);
    line = word;
    if (lines.length >= maxLines) break;
  }
  if (line && lines.length < maxLines) lines.push(line);

  return lines.slice(0, maxLines).map((value, index) => {
    const limit = index === maxLines - 1 ? maxChars - 1 : maxChars;
    return ellipsize(value, limit);
  });
}

function ellipsize(text, maxChars) {
  const value = normalizeReadableText(text);
  if (value.length <= maxChars) return value;
  if (maxChars <= 3) return value.slice(0, maxChars);
  return `${value.slice(0, maxChars - 3).trimEnd()}...`;
}

function normalizeReadableText(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7e]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderJobRasterFallback(label) {
  const main = label.title || label.personName || "Cup label";
  const body = label.bodyLines?.join(" / ") || label.drink || "";
  const footerStart = label.footerStart || label.group || "";
  const footerEnd = label.footerEnd || label.productionClient || "";
  const rows = Array.from({ length: labelRows }, () => Buffer.alloc(bytesPerRow, 0x00));

  drawRect(rows, sx(18), 18, sx(sourceColumns - 36), labelRows - 36, 4);
  drawRect(rows, sx(42), 42, sx(80), 80, 4);
  drawCaptureMark(rows, sx(82), 82, sx(48));
  drawTextBlock(rows, main, sx(146), 48, sx(385), 7, 2);
  drawTextBlock(rows, body, sx(42), 154, sx(508), 5, 3);
  fillRect(rows, sx(42), 282, sx(508), 3);
  drawTextLine(rows, footerStart, sx(42), 302, sx(185), 3);
  drawTextLine(rows, footerEnd, sx(250), 302, sx(300), 3);

  return encodeRows(rows);
}

async function renderSampleRaster() {
  await fs.mkdir("logs", { recursive: true });
  const label = {
    id: "sample-usb-label",
    personName: "Jordan Lee",
    drink: "Iced oat latte, half sweet, cinnamon, no whip",
    group: "Camera Team",
    productionClient: "Capture This Coffee / Day 03",
    notesStatus: "Confirmed",
    title: "Jordan Lee",
    bodyLines: ["Iced oat latte, half sweet", "Cinnamon, no whip"],
    footerStart: "Camera Team",
    footerEnd: "Capture This Coffee / Day 03",
    lines: [
      "Jordan Lee",
      "Iced oat latte, half sweet",
      "Cinnamon, no whip",
      "Camera Team - Capture This Coffee / Day 03",
    ],
  };
  const svg = renderLabelSvg(label);
  const pngPath = `logs/label-serial-sample-${new Date().toISOString().replace(/[:.]/g, "-")}.png`;
  await sharp(Buffer.from(svg))
    .resize(printheadColumns, labelRows, { fit: "fill", kernel: "lanczos3" })
    .png()
    .toFile(pngPath);
  const encoded = await renderJobRasterFromSvg(label);
  const blackPixels = encoded.rowsData.reduce(
    (total, row) => total + row.blackPixelsCount * row.repeat,
    0,
  );
  console.log(`Rendered sample label preview: ${pngPath}`);
  console.log(
    `Raster check: ${printheadColumns} x ${labelRows}, ${encoded.rowsData.length} row runs, ${blackPixels} black pixels.`,
  );
}

function encodeRows(rows) {
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

  return {
    cols: printheadColumns,
    rows: labelRows,
    rowsData,
  };
}

function drawTextBlock(canvas, text, x, y, maxWidth, scale, maxLines) {
  const words = normalizeText(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";

  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (textWidth(next, scale) <= maxWidth || !line) {
      line = next;
      continue;
    }
    lines.push(line);
    line = word;
    if (lines.length >= maxLines) break;
  }
  if (line && lines.length < maxLines) lines.push(line);

  const lineHeight = 8 * scale;
  lines.slice(0, maxLines).forEach((value, index) => {
    drawTextLine(canvas, value, x, y + index * lineHeight, maxWidth, scale);
  });
}

function drawTextLine(canvas, text, x, y, maxWidth, scale) {
  let value = normalizeText(text);
  while (value && textWidth(value, scale) > maxWidth) value = value.slice(0, -1);
  let cursorX = x;
  for (const char of value) {
    const glyph = glyphs[char] || glyphs["?"];
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

function drawCaptureMark(canvas, centerX, centerY, size) {
  const half = Math.floor(size / 2);
  const thickness = Math.max(3, Math.floor(size / 8));
  drawLine(canvas, centerX - half, centerY - half, centerX + half, centerY, thickness);
  drawLine(canvas, centerX + half, centerY, centerX - half, centerY + half, thickness);
}

function drawLine(canvas, x0, y0, x1, y1, thickness) {
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sxStep = x0 < x1 ? 1 : -1;
  const syStep = y0 < y1 ? 1 : -1;
  let error = dx + dy;
  let x = x0;
  let y = y0;

  while (true) {
    fillRect(canvas, x - Math.floor(thickness / 2), y - Math.floor(thickness / 2), thickness, thickness);
    if (x === x1 && y === y1) break;
    const e2 = 2 * error;
    if (e2 >= dy) {
      error += dy;
      x += sxStep;
    }
    if (e2 <= dx) {
      error += dx;
      y += syStep;
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

function sx(value) {
  return Math.round((value * printheadColumns) / sourceColumns);
}

function textWidth(text, scale) {
  return [...text].reduce((width, char) => {
    const glyph = glyphs[char] || glyphs["?"];
    return width + (glyph[0].length + 1) * scale;
  }, 0);
}

function normalizeText(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7e]/g, "")
    .toUpperCase();
}

async function createAttempt(job, portInfo, status, errorMessage = "") {
  const body = {
    status,
    transport: "laptop_usb",
    printer_name: "NIIMBOT M2_H",
    printer_identifier: portInfo.serialNumber || portInfo.path,
    sdk_version: `@mmote/niimblue-node ${niimblueNodePackage.version}; @mmote/niimbluelib ${niimblueLibPackage.version}`,
    error_message: errorMessage || null,
  };
  return (await apiFetch(`/api/print-jobs/${job.id}/attempts`, {
    method: "POST",
    body: JSON.stringify(body),
  })).attempt;
}

async function apiFetch(path, init = {}) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${bearerToken}`,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  });
  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(
      typeof body.error === "string" ? body.error : `Request failed: ${response.status}`,
    );
    error.status = response.status;
    throw error;
  }

  return body;
}

async function resolvePrinterPort() {
  const niimbotPorts = await findNiimbotSerialPorts();
  if (requestedPort) {
    const metadata = niimbotPorts.find((port) => port.path === requestedPort);
    return metadata || { path: requestedPort };
  }
  if (niimbotPorts[0]) return niimbotPorts[0];

  const usbModemPorts = await findUsbModemPorts();
  if (usbModemPorts[0]) return { path: usbModemPorts[0] };

  throw new Error(
    "No NIIMBOT USB serial device found. Pass /dev/cu.usbmodem* or set LABEL_SERIAL_PORT.",
  );
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
  const matches = ports
    .filter((port) => {
      const vendorId = port.vendorId?.toLowerCase().padStart(4, "0");
      const productId = port.productId?.toLowerCase().padStart(4, "0");
      return vendorId === niimbotVendorId && productId === niimbotProductId;
    })
    .map((port) => ({
      ...port,
      path: preferCalloutPath(port.path),
    }))
    .sort((a, b) => a.path.localeCompare(b.path));
  return matches;
}

function preferCalloutPath(path) {
  if (!path.startsWith("/dev/tty.")) return path;
  return `/dev/cu.${path.slice("/dev/tty.".length)}`;
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

function wireLogging(client) {
  client.on("printprogress", (event) => {
    console.log(
      `PrintStatus: page=${event.page}/${event.pagesTotal} printProgress=${event.pagePrintProgress} feedProgress=${event.pageFeedProgress}`,
    );
  });
  if (debug) {
    client.on("packetsent", (event) => {
      const name = RequestCommandId[event.packet.command] || hexId(event.packet.command);
      console.log(`> ${name} ${Utils.bufToHex(event.packet.toBytes())}`);
    });
    client.on("packetreceived", (event) => {
      const name = ResponseCommandId[event.packet.command] || hexId(event.packet.command);
      console.log(`< ${name} ${Utils.bufToHex(event.packet.toBytes())}`);
    });
  }
  client.on("heartbeatfailed", (event) => {
    console.warn(`Heartbeat failed ${event.failedAttempts}`);
  });
  client.on("disconnect", () => {
    console.log("Printer disconnected.");
  });
}

function isPayloadV1(value) {
  return (
    value &&
    value.version === 1 &&
    value.printer_family === "niimbot_m2" &&
    value.dpi === 300 &&
    value.label &&
    value.label_size?.width_mm === 50 &&
    value.label_size?.height_mm === 30
  );
}

function jobTitle(job) {
  return job.payload?.label?.personName || job.payload?.label?.title || "Cup label";
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

function httpStatus(error) {
  return typeof error?.status === "number" ? error.status : 0;
}

function env(name) {
  return process.env[name]?.trim() || "";
}

function stripTrailingSlash(value) {
  return value.replace(/\/+$/, "");
}

function positiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const glyphs = {
  " ": ["000", "000", "000", "000", "000", "000", "000"],
  "!": ["1", "1", "1", "1", "1", "0", "1"],
  '"': ["101", "101", "101", "000", "000", "000", "000"],
  "#": ["01010", "11111", "01010", "01010", "11111", "01010", "00000"],
  "$": ["01110", "10100", "10100", "01110", "00101", "00101", "11110"],
  "%": ["11001", "11010", "00100", "01000", "10110", "00110", "00000"],
  "&": ["01100", "10010", "10100", "01000", "10101", "10010", "01101"],
  "'": ["1", "1", "1", "0", "0", "0", "0"],
  "(": ["01", "10", "10", "10", "10", "10", "01"],
  ")": ["10", "01", "01", "01", "01", "01", "10"],
  "*": ["00000", "10101", "01110", "11111", "01110", "10101", "00000"],
  "+": ["00000", "00100", "00100", "11111", "00100", "00100", "00000"],
  ",": ["0", "0", "0", "0", "1", "1", "1"],
  "-": ["0000", "0000", "0000", "1111", "0000", "0000", "0000"],
  ".": ["0", "0", "0", "0", "0", "1", "1"],
  "/": ["00001", "00010", "00100", "00100", "01000", "10000", "00000"],
  "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  "2": ["01110", "10001", "00001", "00010", "00100", "01000", "11111"],
  "3": ["11110", "00001", "00001", "01110", "00001", "00001", "11110"],
  "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  "5": ["11111", "10000", "10000", "11110", "00001", "00001", "11110"],
  "6": ["01110", "10000", "10000", "11110", "10001", "10001", "01110"],
  "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  "9": ["01110", "10001", "10001", "01111", "00001", "00001", "01110"],
  ":": ["0", "1", "1", "0", "1", "1", "0"],
  ";": ["0", "1", "1", "0", "1", "1", "1"],
  "<": ["0001", "0010", "0100", "1000", "0100", "0010", "0001"],
  "=": ["0000", "1111", "0000", "1111", "0000", "0000", "0000"],
  ">": ["1000", "0100", "0010", "0001", "0010", "0100", "1000"],
  "?": ["01110", "10001", "00001", "00010", "00100", "00000", "00100"],
  "@": ["01110", "10001", "10111", "10101", "10111", "10000", "01110"],
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  C: ["01111", "10000", "10000", "10000", "10000", "10000", "01111"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  G: ["01111", "10000", "10000", "10011", "10001", "10001", "01111"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["111", "010", "010", "010", "010", "010", "111"],
  J: ["00111", "00010", "00010", "00010", "10010", "10010", "01100"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  Q: ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  W: ["10001", "10001", "10001", "10101", "10101", "10101", "01010"],
  X: ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  Z: ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
  "[": ["11", "10", "10", "10", "10", "10", "11"],
  "\\": ["10000", "01000", "00100", "00100", "00010", "00001", "00000"],
  "]": ["11", "01", "01", "01", "01", "01", "11"],
  "_": ["0000", "0000", "0000", "0000", "0000", "0000", "1111"],
};
