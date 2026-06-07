#!/usr/bin/env node

import { execFile } from "node:child_process";
import { constants, promises as fs } from "node:fs";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const defaultPortPrefix = "/dev/cu.usbmodem";
const responseTimeoutMs = 800;
const interCommandDelayMs = 150;

const requestedPort = process.argv.find((arg) => arg.startsWith("/dev/"));
const requests = [
  { name: "Heartbeat", packet: packet(0xdc, [0x04]) },
  { name: "PrintStatus", packet: packet(0xa3, [0x01]) },
  { name: "PrinterStatusData", packet: packet(0xa5, [0x01]) },
  { name: "RfidInfo", packet: packet(0x1a, [0x01]) },
];

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

async function main() {
  const ports = await findUsbModemPorts();
  const port = requestedPort || ports[0];

  console.log("NIIMBOT M2_H USB status probe");
  console.log("This sends read/status protocol requests only.");
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
  try {
    await configureSerialPort(port);
    handle = await fs.open(
      port,
      constants.O_RDWR | constants.O_NOCTTY | constants.O_NONBLOCK,
    );

    for (const request of requests) {
      console.log("");
      console.log(`${request.name}`);
      console.log(`> ${toHex(request.packet)}`);
      await handle.write(request.packet);
      const response = await readResponse(handle, responseTimeoutMs);
      if (response.length) {
        console.log(`< ${toHex(response)}`);
        decodeKnownResponse(response);
      } else {
        console.log("< no response before timeout");
      }
      await sleep(interCommandDelayMs);
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

function decodeKnownResponse(buffer) {
  if (buffer.length < 8 || buffer[0] !== 0x55 || buffer[1] !== 0x55) return;

  const command = buffer[2];
  const dataLength = buffer[3];
  const data = buffer.subarray(4, 4 + dataLength);

  if (command === 0xd9 && data.length >= 9) {
    console.log(`  charge: ${data[0]}`);
    console.log(`  lid closed raw: ${data[1]}`);
    console.log(`  paper inserted raw: ${data[2]}`);
    console.log(`  paper RFID raw: ${data[4]}`);
    console.log(`  ribbon RFID raw: ${data[5]}`);
    console.log(`  ribbon inserted raw: ${data[6]}`);
  }

  if ([0x6a, 0xb3, 0xb5, 0x1b].includes(command)) {
    console.log(`  response id: 0x${command.toString(16)}`);
    console.log(`  data: ${toHex(data) || "(empty)"}`);
  }
}

function toHex(buffer) {
  return [...buffer]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join(" ");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
