#!/usr/bin/env node

import { execFile } from "node:child_process";
import { constants, promises as fs } from "node:fs";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const defaultPortPrefix = "/dev/cu.usbmodem";
const responseTimeoutMs = 1500;
const pollTimeoutMs = 5000;
const interCommandDelayMs = 120;

const labelRows = 354;
const printheadColumns = 567;
const density = 1;
const labelType = 1;
const bytesPerRow = Math.ceil(printheadColumns / 8);

const requestedPort = process.argv.find((arg) => arg.startsWith("/dev/"));
const confirmed = process.argv.includes("--yes");

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
  try {
    await configureSerialPort(port);
    handle = await fs.open(
      port,
      constants.O_RDWR | constants.O_NOCTTY | constants.O_NONBLOCK,
    );

    await sendExpect(handle, "Heartbeat", packet(0xdc, [0x04]), [0xd9, 0xdd, 0xde, 0xdf]);
    await sendExpect(handle, "SetDensity", packet(0x21, [density]), [0x31]);
    await sendExpect(handle, "SetLabelType", packet(0x23, [labelType]), [0x33]);
    await sendExpect(
      handle,
      "PrintStart",
      packet(0x01, [0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]),
      [0x02],
    );
    printStarted = true;
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

    await sendNoWait(handle, "PrintStatus kick", packet(0xa3, [0x01]));
    await sendGlyphRows(handle);
    await sendExpect(handle, "PageEnd", packet(0xe3, [0x01]), [0xe4, 0xd3, 0xb3]);
    await pollPrintStatus(handle);
    await sendExpect(handle, "PrintEnd", packet(0xf3, [0x01]), [0xf4]);
    printEnded = true;
    await sendNoWait(handle, "Heartbeat final", packet(0xdc, [0x04]));
  } catch (error) {
    if (handle && printStarted && !printEnded) {
      await cancelPrint(handle);
    }
    throw error;
  } finally {
    await handle?.close();
  }
}

async function sendGlyphRows(handle) {
  const rows = buildGlyphRows();
  for (let row = 0; row < labelRows; row += 1) {
    const rowBytes = rows.get(row);
    const rowPacket = rowBytes
      ? packet(0x85, [...u16be(row), 0x00, 0x00, 0x00, 0x01, ...rowBytes])
      : packet(0x84, [...u16be(row), 0x01]);
    await sendNoWait(handle, rowBytes ? `BitmapRow ${row}` : `EmptyRow ${row}`, rowPacket, {
      log: row < 3 || Boolean(rowBytes),
    });
  }
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
    await handle.write(request);
    const response = await readResponse(handle, responseTimeoutMs);
    console.log(response.length ? `< ${toHex(response)}` : "< no response before timeout");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Cancel after abort failed: ${message}`);
  }
}

async function sendExpect(handle, name, request, expectedResponseIds) {
  await sendNoWait(handle, name, request);
  const response = await readResponse(handle, responseTimeoutMs);
  if (!response.length) throw new Error(`${name}: no response before timeout`);

  console.log(`< ${toHex(response)}`);
  const frames = parseFrames(response);
  const matched = frames.some((frame) => expectedResponseIds.includes(frame.command));
  if (!matched) {
    throw new Error(
      `${name}: expected response ${expectedResponseIds.map(hexId).join(" or ")}, got ${frames
        .map((frame) => hexId(frame.command))
        .join(", ") || "unframed bytes"}`,
    );
  }

  for (const frame of frames) {
    if (frame.data.length === 1 && frame.data[0] === 0x00) {
      throw new Error(`${name}: printer returned failure byte 00`);
    }
  }

  await sleep(interCommandDelayMs);
}

async function sendNoWait(handle, name, request, options = {}) {
  if (options.log !== false) {
    console.log("");
    console.log(name);
    console.log(`> ${toHex(request)}`);
  }
  await handle.write(request);
}

async function pollPrintStatus(handle) {
  const deadline = Date.now() + pollTimeoutMs;
  while (Date.now() < deadline) {
    await sendNoWait(handle, "PrintStatus poll", packet(0xa3, [0x01]));
    const response = await readResponse(handle, responseTimeoutMs);
    if (response.length) {
      console.log(`< ${toHex(response)}`);
      const frames = parseFrames(response);
      if (frames.some((frame) => frame.command === 0xb3)) return;
    }
    await sleep(250);
  }
  throw new Error("PrintStatus poll timed out.");
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
        if (parseFrames(joined).length) return joined;
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

  return Buffer.concat(chunks);
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
