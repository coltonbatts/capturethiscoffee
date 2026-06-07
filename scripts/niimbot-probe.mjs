#!/usr/bin/env node

import { execFile } from "node:child_process";
import { constants, promises as fs } from "node:fs";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const defaultPortPrefix = "/dev/cu.usbmodem";
const defaultCommands = ["10001", "10003"];
const commandTimeoutMs = 1500;

const requestedPort = process.argv.find((arg) => arg.startsWith("/dev/"));

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

async function main() {
  const ports = await findUsbModemPorts();

  console.log("NIIMBOT M2_H USB serial probe");
  console.log("This only sends read-only identity/version queries.");
  console.log("");

  if (ports.length) {
    console.log("Detected USB modem serial devices:");
    for (const port of ports) console.log(`- ${port}`);
  } else {
    console.log(`No ${defaultPortPrefix}* devices were detected.`);
  }

  const port = requestedPort || ports[0];
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

    for (const command of defaultCommands) {
      const frame = frameCommand(command);
      console.log("");
      console.log(`> ${frame}`);
      const response = await sendQuery(handle, frame, commandTimeoutMs);
      if (response) {
        console.log(`< ${response}`);
      } else {
        console.log("< no response before timeout");
      }
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

async function sendQuery(handle, frame, timeoutMs) {
  await handle.write(Buffer.from(frame, "ascii"));

  const deadline = Date.now() + timeoutMs;
  const chunks = [];
  const buffer = Buffer.alloc(256);

  while (Date.now() < deadline) {
    try {
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, null);
      if (bytesRead > 0) {
        chunks.push(Buffer.from(buffer.subarray(0, bytesRead)));
        const text = Buffer.concat(chunks).toString("ascii");
        if (text.includes("#") && /\*[0-9A-Fa-f]{2}#$/.test(text.trim())) {
          return text.trim();
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

  return Buffer.concat(chunks).toString("ascii").trim();
}

function frameCommand(command) {
  const payload = command.replace(/^#/, "").replace(/[#*].*$/, "");
  return `#${payload}*${checksum(payload)}#`;
}

function checksum(payload) {
  let value = 0;
  for (const char of payload) value ^= char.charCodeAt(0);
  return value.toString(16).toUpperCase().padStart(2, "0");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
