#!/usr/bin/env node

import { execFile } from "node:child_process";
import { constants, promises as fs } from "node:fs";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const defaultPortPrefix = "/dev/cu.usbmodem";
const responseTimeoutMs = 3000;
const printTestPagePacket = packet(0x5a, [0x01]);

const requestedPort = process.argv.find((arg) => arg.startsWith("/dev/"));
const confirmed = process.argv.includes("--yes");

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

async function main() {
  if (!confirmed) {
    console.error(
      "Refusing to send a print command without --yes. This may consume a label.",
    );
    console.error("Usage: npm run niimbot:test-print -- --yes [/dev/cu.usbmodem1101]");
    process.exitCode = 1;
    return;
  }

  const ports = await findUsbModemPorts();
  const port = requestedPort || ports[0];

  console.log("NIIMBOT M2_H USB test print");
  console.log("This sends the NIIMBOT protocol PrintTestPage packet.");
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
  console.log(`> ${toHex(printTestPagePacket)}`);

  let handle;
  try {
    await configureSerialPort(port);
    handle = await fs.open(
      port,
      constants.O_RDWR | constants.O_NOCTTY | constants.O_NONBLOCK,
    );
    await handle.write(printTestPagePacket);
    const response = await readResponse(handle, responseTimeoutMs);
    if (response.length) {
      console.log(`< ${toHex(response)}`);
    } else {
      console.log("< no response before timeout");
    }
  } finally {
    await handle?.close();
  }
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
  const buffer = Buffer.alloc(256);

  while (Date.now() < deadline) {
    try {
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, null);
      if (bytesRead > 0) {
        chunks.push(Buffer.from(buffer.subarray(0, bytesRead)));
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

function toHex(buffer) {
  return [...buffer]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join(" ");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
