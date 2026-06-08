#!/usr/bin/env node

import { execFile } from "node:child_process";
import { constants, promises as fs } from "node:fs";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const defaultPortPrefix = "/dev/cu.usbmodem";
const responseTimeoutMs = 1500;
const pollTimeoutMs = 15000;
const interCommandDelayMs = 120;
const writeTimeoutMs = 5000;
const pendingReadTimeoutMs = 80;

const labelRows = 354;
const printheadColumns = 567;
const density = 1;
const labelType = 1;
const bytesPerRow = Math.ceil(printheadColumns / 8);

const requestedPort = process.argv.find((arg) => arg.startsWith("/dev/"));
const confirmed = process.argv.includes("--yes");
const verboseRows = process.argv.includes("--verbose-rows");
const blackCountArg = process.argv.find((arg) => arg.startsWith("--black-count="));
const printTaskArg = process.argv.find((arg) => arg.startsWith("--task="));
const printTask = printTaskArg?.split("=")[1] || "b1";
const blackCountMode = blackCountArg?.split("=")[1] || (printTask === "b1" ? "total" : "zero");

let transcriptHandle;
const transportStats = {
  bytesWritten: 0,
  eagainRetries: 0,
  partialWrites: 0,
  zeroWrites: 0,
  passiveReads: 0,
  rowPackets: 0,
  bitmapRows: 0,
  emptyRows: 0,
};
const bitCounts = Array.from({ length: 256 }, (_, value) => {
  let count = 0;
  for (let bit = 0; bit < 8; bit += 1) {
    if (value & (1 << bit)) count += 1;
  }
  return count;
});

const glyphs = {
  " ": ["000", "000", "000", "000", "000", "000", "000"],
  B: ["1110", "1001", "1001", "1110", "1001", "1001", "1110"],
  E: ["1111", "1000", "1000", "1110", "1000", "1000", "1111"],
  F: ["1111", "1000", "1000", "1110", "1000", "1000", "1000"],
  K: ["1001", "1010", "1100", "1000", "1100", "1010", "1001"],
  L: ["1000", "1000", "1000", "1000", "1000", "1000", "1111"],
  O: ["0110", "1001", "1001", "1001", "1001", "1001", "0110"],
  P: ["1110", "1001", "1001", "1110", "1000", "1000", "1000"],
  S: ["0111", "1000", "1000", "0110", "0001", "0001", "1110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["1001", "1001", "1001", "1001", "1001", "1001", "0110"],
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

async function main() {
  if (!confirmed) {
    console.error(
      "Refusing to send a glyph test without --yes. This may consume one label.",
    );
    console.error(
      "Usage: npm run niimbot:print-glyph-test -- --yes [/dev/cu.usbmodem101]",
    );
    process.exitCode = 1;
    return;
  }

  const ports = await findUsbModemPorts();
  const port = requestedPort || ports[0];

  console.log("NIIMBOT M2_H USB glyph test print");
  console.log("This sends one low-density 50x30mm calibration label.");
  console.log(`Bitmap dimensions: ${printheadColumns} columns x ${labelRows} rows`);
  console.log("Orientation markers: TOP starts near row 42, column 236.");
  console.log("Orientation markers: LEFT starts near row 136, column 42.");
  console.log("Content: sparse border box, TOP, LEFT, USB OK.");
  console.log(`Print task: ${printTask}.`);
  console.log(`Bitmap row black-count mode: ${blackCountMode}.`);
  console.log("CancelPrint 0xda is only used for abort cleanup before PrintEnd.");
  console.log("");

  if (ports.length) {
    console.log("Detected USB modem serial devices:");
    for (const detectedPort of ports) console.log(`- ${detectedPort}`);
  } else {
    console.log(`No ${defaultPortPrefix}* devices were detected.`);
  }

  if (!port) {
    console.log("");
    console.log("Connect the printer over USB-C, power it on, then retry.");
    return;
  }

  console.log("");
  console.log(`Opening ${port}`);

  let handle;
  let printStarted = false;
  let printEnded = false;
  let printEndSent = false;
  const transcriptPath = new URL(
    `../logs/niimbot-glyph-${new Date().toISOString().replace(/[:.]/g, "-")}.log`,
    import.meta.url,
  );
  try {
    await fs.mkdir(new URL("../logs/", import.meta.url), { recursive: true });
    transcriptHandle = await fs.open(transcriptPath, "w");
    await appendTranscript(`# NIIMBOT glyph test ${new Date().toISOString()}`);
    await appendTranscript(`# port=${port} task=${printTask} rows=${labelRows} columns=${printheadColumns}`);
    console.log(`Raw transcript: ${transcriptPath.pathname}`);

    await configureSerialPort(port);
    handle = await fs.open(
      port,
      constants.O_RDWR | constants.O_NOCTTY | constants.O_NONBLOCK,
    );

    await sendExpect(handle, "Heartbeat", packet(0xdc, [0x04]), [0xd9, 0xdd, 0xde, 0xdf]);
    await sendExpect(handle, "SetDensity", packet(0x21, [density]), [0x31]);
    await sendExpect(handle, "SetLabelType", packet(0x23, [labelType]), [0x33]);
    await sendPrintStart(handle);
    printStarted = true;
    await sendPageSetup(handle);

    if (printTask === "d110m-v4") {
      await sendNoWait(handle, "PrintStatus kick", packet(0xa3, [0x01]));
    }
    await sendGlyphRows(handle);
    await sendExpect(handle, "PageEnd", packet(0xe3, [0x01]), [0xe4, 0xd3, 0xb3]);
    await pollPrintStatus(handle);
    printEndSent = true;
    await sendExpect(handle, "PrintEnd", packet(0xf3, [0x01]), [0xf4], {
      continueOnResponseIds: [0xb3, 0xd3, 0xe4],
      timeoutMs: 5000,
    });
    printEnded = true;
    await sendNoWait(handle, "Heartbeat final", packet(0xdc, [0x04]));
  } catch (error) {
    if (handle && printStarted && !printEnded && !printEndSent) {
      await cancelPrint(handle);
    }
    throw error;
  } finally {
    await handle?.close();
    await appendTranscript("# serial handle closed");
    await transcriptHandle?.close();
    console.log("");
    console.log(
      `Transport: wrote ${transportStats.bytesWritten} bytes, EAGAIN retries ${transportStats.eagainRetries}, partial writes ${transportStats.partialWrites}, zero writes ${transportStats.zeroWrites}, passive read batches ${transportStats.passiveReads}.`,
    );
    console.log(
      `Rows: ${transportStats.rowPackets} packets (${transportStats.bitmapRows} bitmap, ${transportStats.emptyRows} empty).`,
    );
    console.log("Serial handle closed.");
  }
}

async function sendPrintStart(handle) {
  if (printTask === "b1") {
    await sendExpect(
      handle,
      "PrintStart",
      packet(0x01, [0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00]),
      [0x02],
    );
    return;
  }

  if (printTask === "d110m-v4") {
    await sendExpect(
      handle,
      "PrintStart",
      packet(0x01, [0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]),
      [0x02],
    );
    return;
  }

  throw new Error(`Unsupported print task: ${printTask}`);
}

async function sendPageSetup(handle) {
  if (printTask === "b1") {
    await sendExpect(handle, "PageStart", packet(0x03, [0x01]), [0x04]);
    await sendExpect(
      handle,
      "SetPageSize",
      packet(0x13, [...u16be(labelRows), ...u16be(printheadColumns), ...u16be(1)]),
      [0x14],
    );
    return;
  }

  if (printTask === "d110m-v4") {
    await sendExpect(
      handle,
      "SetPageSize",
      packet(0x13, [
        ...u16be(labelRows),
        ...u16be(printheadColumns),
        ...u16be(1),
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
      ]),
      [0x14],
    );
    return;
  }

  throw new Error(`Unsupported print task: ${printTask}`);
}

async function sendGlyphRows(handle) {
  const rows = buildGlyphRows();
  const profile = rowWriteProfile();
  console.log(`Non-empty bitmap rows: ${rows.size} of ${labelRows}`);
  console.log(
    `Row pacing: ${profile.rowDelayMs}ms per row, ${profile.batchDelayMs}ms after ${profile.batchSize}-row batches, passive drain ${profile.drainBetweenBatches ? "enabled" : "disabled"}.`,
  );

  for (let row = 0; row < labelRows; row += 1) {
    const rowBytes = rows.get(row);
    const rowPacket = rowBytes
      ? packet(0x85, [...u16be(row), ...blackCountSegment(rowBytes), 0x01, ...rowBytes])
      : packet(0x84, [...u16be(row), 0x01]);
    transportStats.rowPackets += 1;
    if (rowBytes) transportStats.bitmapRows += 1;
    else transportStats.emptyRows += 1;
    await sendNoWait(handle, rowBytes ? `BitmapRow ${row}` : `EmptyRow ${row}`, rowPacket, {
      log: shouldLogRow(row, rowBytes, profile),
      compact: true,
    });
    if (profile.rowDelayMs > 0) await sleep(profile.rowDelayMs);
    if ((row + 1) % profile.batchSize === 0) {
      if (profile.drainBetweenBatches) await readPendingFrames(handle, `row batch ending ${row}`);
      if (profile.batchDelayMs > 0) await sleep(profile.batchDelayMs);
    }
  }

  if (profile.drainBetweenBatches) await readPendingFrames(handle, "rows complete");
}

function buildGlyphRows() {
  const canvas = Array.from({ length: labelRows }, () => Buffer.alloc(bytesPerRow, 0x00));

  drawRect(canvas, 24, 24, 518, 306, 2);
  drawText(canvas, "TOP", 236, 42, 5);
  drawText(canvas, "LEFT", 42, 136, 4);
  drawText(canvas, "USB OK", 134, 152, 8);

  const rows = new Map();
  for (let row = 0; row < canvas.length; row += 1) {
    if (canvas[row].some((byte) => byte !== 0x00)) rows.set(row, canvas[row]);
  }
  return rows;
}

function drawText(canvas, text, x, y, scale) {
  let cursorX = x;
  for (const char of text) {
    const glyph = glyphs[char];
    if (!glyph) throw new Error(`No deterministic glyph defined for ${char}`);
    drawGlyph(canvas, glyph, cursorX, y, scale);
    cursorX += (glyph[0].length + 1) * scale;
  }
}

function drawGlyph(canvas, glyph, x, y, scale) {
  for (let row = 0; row < glyph.length; row += 1) {
    for (let column = 0; column < glyph[row].length; column += 1) {
      if (glyph[row][column] !== "1") continue;
      fillRect(canvas, x + column * scale, y + row * scale, scale, scale);
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

async function cancelPrint(handle) {
  try {
    const request = packet(0xda, [0x01]);
    console.log("");
    console.log("Cancel after abort");
    console.log(`> ${toHex(request)}`);
    await writeAll(handle, request, "Cancel after abort");
    const response = await readResponse(handle, responseTimeoutMs);
    console.log(response.length ? `< ${toHex(response)}` : "< no response before timeout");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Cancel after abort failed: ${message}`);
  }
}

async function sendExpect(handle, name, request, expectedResponseIds, options = {}) {
  await sendNoWait(handle, name, request);
  const timeoutMs = options.timeoutMs ?? responseTimeoutMs;
  const continueOnResponseIds = options.continueOnResponseIds ?? [];
  const deadline = Date.now() + timeoutMs;
  const seenCommands = [];

  while (Date.now() < deadline) {
    const response = await readResponse(handle, Math.min(responseTimeoutMs, deadline - Date.now()));
    if (!response.length) {
      if (seenCommands.length) break;
      continue;
    }

    console.log(`< ${toHex(response)}`);
    const frames = parseFrames(response);
    logFrames(frames);
    seenCommands.push(...frames.map((frame) => frame.command));

    for (const frame of frames) {
      if (frame.data.length === 1 && frame.data[0] === 0x00) {
        throw new Error(`${name}: printer returned failure byte 00`);
      }
    }

    const matched = frames.some((frame) => expectedResponseIds.includes(frame.command));
    if (matched) {
      await sleep(interCommandDelayMs);
      return;
    }

    const canContinue = frames.length && frames.every((frame) => continueOnResponseIds.includes(frame.command));
    if (!canContinue) break;
  }

  throw new Error(
    `${name}: expected response ${expectedResponseIds.map(hexId).join(" or ")}, got ${
      seenCommands.map(hexId).join(", ") || "no response before timeout"
    }`,
  );
}

async function sendNoWait(handle, name, request, options = {}) {
  if (options.log !== false) {
    console.log("");
    console.log(name);
    if (options.compact) {
      console.log(`> ${describePacket(request)}`);
    } else {
      console.log(`> ${toHex(request)}`);
    }
  }
  await appendTranscript(`TX ${name}: ${toHex(request)}`);
  await writeAll(handle, request, name);
}

async function pollPrintStatus(handle) {
  const deadline = Date.now() + pollTimeoutMs;
  while (Date.now() < deadline) {
    await sendNoWait(handle, "PrintStatus poll", packet(0xa3, [0x01]));
    const response = await readResponse(handle, responseTimeoutMs);
    if (response.length) {
      console.log(`< ${toHex(response)}`);
      await appendTranscript(`RX PrintStatus poll: ${toHex(response)}`);
      const frames = parseFrames(response);
      logFrames(frames);
      for (const frame of frames) {
        if (frame.command !== 0xb3) continue;
        const status = parsePrintStatus(frame.data);
        console.log(
          `  print status page=${status.page} printProgress=${status.pagePrintProgress} feedProgress=${status.pageFeedProgress} error=${status.error}`,
        );
        if (status.error !== 0) {
          throw new Error(`PrintStatus poll returned printer error ${status.error}`);
        }
        if (status.page >= 1) return;
      }
    }
    await sleep(250);
  }
  throw new Error("PrintStatus poll timed out before page 1 completion.");
}

async function findUsbModemPorts() {
  const entries = await fs.readdir("/dev");
  return entries
    .filter((entry) => entry.startsWith("cu.usbmodem"))
    .sort()
    .map((entry) => `/dev/${entry}`);
}

async function configureSerialPort(port) {
  try {
    await execFileAsync("stty", [
      "-f",
      port,
      "115200",
      "cs8",
      "-cstopb",
      "-parenb",
      "raw",
      "-echo",
      "min",
      "0",
      "time",
      "1",
    ]);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Could not configure ${port} with stty: ${message}`);
  }
}

async function readResponse(handle, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  const chunks = [];
  const buffer = Buffer.alloc(512);

  while (Date.now() < deadline) {
    try {
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, null);
      if (bytesRead > 0) {
        chunks.push(Buffer.from(buffer.subarray(0, bytesRead)));
        const joined = Buffer.concat(chunks);
        if (parseFrames(joined).length) {
          await appendTranscript(`RX: ${toHex(joined)}`);
          return joined;
        }
      } else {
        await sleep(50);
      }
    } catch (error) {
      if (error?.code === "EAGAIN") {
        await sleep(50);
        continue;
      }
      throw error;
    }
  }

  const joined = Buffer.concat(chunks);
  if (joined.length) await appendTranscript(`RX partial/timeout: ${toHex(joined)}`);
  return joined;
}

async function writeAll(handle, request, name) {
  const deadline = Date.now() + writeTimeoutMs;
  let offset = 0;
  let backoffMs = 8;

  while (offset < request.length) {
    if (Date.now() >= deadline) {
      throw new Error(
        `${name}: write timed out after ${writeTimeoutMs}ms at ${offset}/${request.length} bytes`,
      );
    }

    try {
      const { bytesWritten } = await handle.write(
        request,
        offset,
        request.length - offset,
        null,
      );
      if (bytesWritten > 0) {
        if (bytesWritten < request.length - offset) transportStats.partialWrites += 1;
        offset += bytesWritten;
        transportStats.bytesWritten += bytesWritten;
        backoffMs = 8;
        continue;
      }

      transportStats.zeroWrites += 1;
      await sleep(backoffMs);
      backoffMs = Math.min(backoffMs * 2, 120);
    } catch (error) {
      if (error?.code !== "EAGAIN") throw error;
      transportStats.eagainRetries += 1;
      await sleep(backoffMs);
      backoffMs = Math.min(backoffMs * 2, 120);
    }
  }
}

async function readPendingFrames(handle, label) {
  const response = await readResponse(handle, pendingReadTimeoutMs);
  if (!response.length) return;

  transportStats.passiveReads += 1;
  console.log("");
  console.log(`Passive read after ${label}`);
  console.log(`< ${toHex(response)}`);
  logFrames(parseFrames(response));
}

function rowWriteProfile() {
  if (printTask === "b1") {
    return {
      rowDelayMs: 10,
      batchSize: 24,
      batchDelayMs: 120,
      drainBetweenBatches: true,
    };
  }

  return {
    rowDelayMs: 2,
    batchSize: 64,
    batchDelayMs: 40,
    drainBetweenBatches: false,
  };
}

function blackCountSegment(rowBytes) {
  if (blackCountMode === "zero") return [0x00, 0x00, 0x00];

  const count = countBlackPixels(rowBytes);
  if (blackCountMode === "total") return [0x00, count & 0xff, (count >> 8) & 0xff];

  if (blackCountMode === "split") {
    const chunkSize = Math.ceil(bytesPerRow / 3);
    return [0, 1, 2].map((chunk) => {
      const start = chunk * chunkSize;
      const end = Math.min(start + chunkSize, rowBytes.length);
      const count = countBlackPixels(rowBytes.subarray(start, end));
      if (count > 0xff) {
        throw new Error(
          `--black-count=split produced ${count} pixels in chunk ${chunk}; use --black-count=total`,
        );
      }
      return count;
    });
  }

  throw new Error(`Unsupported --black-count mode: ${blackCountMode}`);
}

function countBlackPixels(rowBytes) {
  let count = 0;
  for (const byte of rowBytes) count += bitCounts[byte];
  return count;
}

function shouldLogRow(row, rowBytes, profile) {
  if (verboseRows) return true;
  if (row < 3 || row === labelRows - 1) return true;
  if (rowBytes && (row === 24 || row === 329)) return true;
  return (row + 1) % profile.batchSize === 0;
}

function packet(command, data) {
  const bytes = [0x55, 0x55, command, data.length, ...data];
  let checksum = command ^ data.length;
  for (const byte of data) checksum ^= byte;
  bytes.push(checksum, 0xaa, 0xaa);
  return Buffer.from(bytes);
}

function parseFrames(buffer) {
  const frames = [];
  for (let index = 0; index <= buffer.length - 7; index += 1) {
    if (buffer[index] !== 0x55 || buffer[index + 1] !== 0x55) continue;
    const command = buffer[index + 2];
    const dataLength = buffer[index + 3];
    const end = index + 4 + dataLength + 3;
    if (end > buffer.length) continue;
    if (buffer[end - 2] !== 0xaa || buffer[end - 1] !== 0xaa) continue;
    frames.push({
      command,
      data: buffer.subarray(index + 4, index + 4 + dataLength),
    });
    index = end - 1;
  }
  return frames;
}

function parsePrintStatus(data) {
  if (data.length < 4) {
    throw new Error(`PrintStatus data too short: ${toHex(data)}`);
  }
  return {
    page: (data[0] << 8) | data[1],
    pagePrintProgress: data[2],
    pageFeedProgress: data[3],
    error: data.length >= 7 ? data[6] : 0,
  };
}

function logFrames(frames) {
  for (const frame of frames) {
    console.log(`  frame ${hexId(frame.command)} data=${toHex(frame.data) || "(empty)"}`);
  }
}

function describePacket(buffer) {
  const frames = parseFrames(buffer);
  if (frames.length !== 1) return toHex(buffer);
  const [frame] = frames;
  return `${hexId(frame.command)} len=${frame.data.length} data=${summarizeData(frame.data)}`;
}

function summarizeData(data) {
  if (data.length <= 16) return toHex(data) || "(empty)";
  return `${toHex(data.subarray(0, 12))} ... ${toHex(data.subarray(-4))}`;
}

async function appendTranscript(line) {
  if (!transcriptHandle) return;
  await transcriptHandle.write(`${line}\n`);
}

function u16be(value) {
  return [(value >> 8) & 0xff, value & 0xff];
}

function toHex(buffer) {
  return [...buffer]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join(" ");
}

function hexId(value) {
  return `0x${value.toString(16).padStart(2, "0")}`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
