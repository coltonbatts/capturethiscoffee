#!/usr/bin/env node

import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { promises as fs } from "node:fs";
import path from "node:path";
import process from "node:process";

const require = createRequire(import.meta.url);

const repoRoot = path.resolve(new URL("..", import.meta.url).pathname);
const appUrl = "http://localhost:3000";
const stationUrl = `${appUrl}/labels/station`;
const readinessUrl = `${appUrl}/api/print-station/local-readiness`;
const niimbotVendorId = "3513";
const niimbotProductId = "0002";
const fallbackPortPrefix = "/dev/cu.usbmodem";
const serverReadyTimeoutMs = 90_000;

main().catch((error) => {
  console.error("");
  console.error(`Print station did not start: ${messageFor(error)}`);
  console.error("");
  console.error(
    "Operator next action: check the printer cable and call the on-set tech lead.",
  );
  process.exitCode = 1;
});

async function main() {
  assertRepoRoot();
  await assertDependencies();

  const detectedPort = await detectNiimbotPort();
  const stationEnv = {
    ...process.env,
    LABEL_SERIAL_PORT: detectedPort,
    LABEL_SERIAL_API_BASE_URL: appUrl,
  };

  console.log("Capture This Coffee print station");
  console.log(`Repo path: ${repoRoot}`);
  console.log(`Detected NIIMBOT port: ${detectedPort}`);
  console.log(`Server URL: ${stationUrl}`);
  console.log("");

  const existingServer = await checkExistingServer();
  if (existingServer.ok) {
    console.log("Local server: already running for this app");
    await openStation();
    await printReadiness();
    printOperatorAction();
    return;
  }

  if (existingServer.running) {
    throw new Error(
      "Port 3000 is already in use, but it does not look like this app. Close the other local server and double-click Start Print Station again.",
    );
  }

  if (await buildIsStale()) {
    console.log("Build: creating a fresh production build");
    await runCommand("npm", ["run", "build"], stationEnv);
  } else {
    console.log("Build: existing production build is current enough");
  }

  console.log("Local server: starting production server");
  const server = spawn("npm", ["run", "start"], {
    cwd: repoRoot,
    env: stationEnv,
    stdio: "inherit",
  });

  server.on("exit", (code, signal) => {
    if (signal) process.exitCode = 1;
    if (typeof code === "number" && code !== 0) process.exitCode = code;
  });

  await waitForServer();
  await openStation();
  await printReadiness();
  printOperatorAction();
}

function assertRepoRoot() {
  const cwd = process.cwd();
  const packagePath = path.join(cwd, "package.json");
  if (path.resolve(cwd) !== repoRoot || !existsSync(packagePath)) {
    throw new Error(
      `Run this from the Capture This Coffee repo root: ${repoRoot}`,
    );
  }

  const packageJson = require(packagePath);
  if (packageJson.name !== "capture-this-coffee") {
    throw new Error(`This folder is not the Capture This Coffee app: ${cwd}`);
  }
}

async function assertDependencies() {
  await runCommand("node", ["--version"], process.env, { quiet: true });
  await runCommand("npm", ["--version"], process.env, { quiet: true });

  if (!existsSync(path.join(repoRoot, "node_modules", "next"))) {
    throw new Error(
      "Dependencies are missing. Run npm install once, then double-click the launcher again.",
    );
  }
}

async function detectNiimbotPort() {
  const ports = await listSerialPorts();
  const envPort = process.env.LABEL_SERIAL_PORT?.trim();

  if (envPort && ports.some((port) => port.path === envPort)) {
    return envPort;
  }

  const niimbotPort = ports.find((port) => {
    const vendorId = port.vendorId?.toLowerCase().padStart(4, "0");
    const productId = port.productId?.toLowerCase().padStart(4, "0");
    return vendorId === niimbotVendorId && productId === niimbotProductId;
  });
  if (niimbotPort) return niimbotPort.path;

  const fallbackPort = ports.find((port) =>
    port.path.startsWith(fallbackPortPrefix),
  );
  if (fallbackPort) return fallbackPort.path;

  throw new Error(
    `No likely NIIMBOT USB serial port was found. Plug in and power on the NIIMBOT, then retry. Expected ${niimbotVendorId}:${niimbotProductId} or ${fallbackPortPrefix}*.`,
  );
}

async function listSerialPorts() {
  try {
    const { SerialPort } = require("serialport");
    const ports = await SerialPort.list();
    return ports
      .map((port) => ({ ...port, path: preferCalloutPath(port.path) }))
      .sort((a, b) => a.path.localeCompare(b.path));
  } catch {
    const entries = await fs.readdir("/dev").catch(() => []);
    return entries
      .filter((entry) => entry.startsWith("cu.usbmodem"))
      .sort()
      .map((entry) => ({ path: `/dev/${entry}` }));
  }
}

function preferCalloutPath(portPath) {
  if (!portPath.startsWith("/dev/tty.")) return portPath;
  return `/dev/cu.${portPath.slice("/dev/tty.".length)}`;
}

async function checkExistingServer() {
  try {
    const response = await fetch(readinessUrl, { cache: "no-store" });
    const text = await response.text();
    const data = safeJson(text);
    return {
      running: true,
      ok: Boolean(data?.local) && typeof data?.message === "string",
    };
  } catch {
    return { running: false, ok: false };
  }
}

async function buildIsStale() {
  const buildMarker = path.join(repoRoot, ".next", "BUILD_ID");
  const markerStat = await fs.stat(buildMarker).catch(() => null);
  if (!markerStat) return true;

  const watchedPaths = [
    "package.json",
    "package-lock.json",
    "next.config.ts",
    "tsconfig.json",
    "src",
    "public",
  ];

  for (const relativePath of watchedPaths) {
    const absolutePath = path.join(repoRoot, relativePath);
    if (await hasNewerMtime(absolutePath, markerStat.mtimeMs)) return true;
  }

  return false;
}

async function hasNewerMtime(absolutePath, markerMtimeMs) {
  const stat = await fs.stat(absolutePath).catch(() => null);
  if (!stat) return false;
  if (stat.mtimeMs > markerMtimeMs) return true;
  if (!stat.isDirectory()) return false;

  const entries = await fs.readdir(absolutePath, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === ".next" || entry.name === "node_modules") continue;
    if (await hasNewerMtime(path.join(absolutePath, entry.name), markerMtimeMs)) {
      return true;
    }
  }
  return false;
}

async function waitForServer() {
  const deadline = Date.now() + serverReadyTimeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(readinessUrl, { cache: "no-store" });
      if (response.ok || response.status === 500) return;
    } catch {
      await sleep(1_000);
    }
  }
  throw new Error("The local server did not become ready on http://localhost:3000.");
}

async function printReadiness() {
  try {
    const response = await fetch(readinessUrl, { cache: "no-store" });
    const data = await response.json();
    console.log(
      `Readiness endpoint: ${data.ok ? "green" : "not ready"} - ${data.message}`,
    );
  } catch (error) {
    console.log(`Readiness endpoint: unavailable - ${messageFor(error)}`);
  }
}

async function openStation() {
  await runCommand("open", [stationUrl], process.env, { quiet: true });
}

function printOperatorAction() {
  console.log(
    `Operator next action: wait for green readiness, then use ${stationUrl}.`,
  );
  console.log(
    "If USB readiness fails, use browser print or Download PNG from the station page.",
  );
}

async function runCommand(command, args, env, options = {}) {
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: repoRoot,
      env,
      stdio: options.quiet ? "ignore" : "inherit",
    });
    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(
        new Error(
          `${command} ${args.join(" ")} failed${
            signal ? ` with ${signal}` : ` with exit code ${code}`
          }`,
        ),
      );
    });
  });
}

function safeJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function messageFor(error) {
  return error instanceof Error ? error.message : String(error);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
