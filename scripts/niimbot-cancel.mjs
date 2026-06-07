#!/usr/bin/env node

import { execFile } from "node:child_process";
import { constants, promises as fs } from "node:fs";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const requestedPort = process.argv.find((arg) => arg.startsWith("/dev/"));
const timeoutMs = 1500;

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

async function main() {
  const port = requestedPort || (await findUsbModemPorts())[0];
  if (!port) throw new Error("No /dev/cu.usbmodem* device found.");

  let handle;
  try {
    await configureSerialPort(port);
    handle = await fs.open(
      port,
      constants.O_RDWR | constants.O_NOCTTY | constants.O_NONBLOCK,
    );
    const request = packet(0xda, [0x01]);
    console.log(`Opening ${port}`);
    console.log(`> ${toHex(request)}`);
    await handle.write(request);
    const response = await readResponse(handle, timeoutMs);
    console.log(response.length ? `< ${toHex(response)}` : "< no response before timeout");
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
}

async function readResponse(handle, timeout) {
  const deadline = Date.now() + timeout;
  const chunks = [];
  const buffer = Buffer.alloc(256);

  while (Date.now() < deadline) {
    try {
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, null);
      if (bytesRead > 0) chunks.push(Buffer.from(buffer.subarray(0, bytesRead)));
      else await sleep(50);
    } catch (error) {
      if (error?.code !== "EAGAIN") throw error;
      await sleep(50);
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
