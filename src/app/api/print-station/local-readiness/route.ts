import { execFile } from "node:child_process";
import { promisify } from "node:util";

export const runtime = "nodejs";

type SerialPortInfo = {
  path: string;
  vendorId?: string;
  productId?: string;
  serialNumber?: string;
};

const niimbotVendorId = "3513";
const niimbotProductId = "0002";
const execFileAsync = promisify(execFile);

export async function GET(request: Request) {
  const url = new URL(request.url);

  if (!isLocalStationHost(url.hostname) || isHostedRuntime()) {
    return Response.json({
      ok: false,
      local: false,
      configuredPort: process.env.LABEL_SERIAL_PORT || "",
      ports: [],
      message:
        "USB printing requires the local station server at http://localhost:3000/labels/station. Browser Bluetooth visibility does not give the hosted server access to this laptop's USB port.",
    });
  }

  const configuredPort = process.env.LABEL_SERIAL_PORT || "";

  try {
    const ports = await listSerialPorts();
    const visiblePorts = ports
      .filter(isLikelyNiimbotPort)
      .map((port) => port.path)
      .sort();
    const configuredPortVisible = configuredPort
      ? ports.some((port) => port.path === configuredPort)
      : false;
    const ready = configuredPort
      ? configuredPortVisible
      : visiblePorts.length > 0;

    return Response.json({
      ok: ready,
      local: true,
      configuredPort,
      configuredPortVisible,
      ports: visiblePorts,
      message: ready
        ? configuredPort
          ? `Local station server can see ${configuredPort}.`
          : "Local station server can see a NIIMBOT USB serial port."
        : configuredPort
          ? `Local station server is running, but ${configuredPort} is not visible. Check the cable, power, and LABEL_SERIAL_PORT.`
          : "Local station server is running, but no NIIMBOT USB serial port is visible. Set LABEL_SERIAL_PORT after connecting the printer.",
    });
  } catch {
    return Response.json(
      {
        ok: false,
        local: true,
        configuredPort,
        ports: [],
        message:
          "Local station server is running, but it could not inspect USB serial ports. Check local dependencies and use browser print / PNG download as fallback.",
      },
      { status: 500 },
    );
  }
}

async function listSerialPorts(): Promise<SerialPortInfo[]> {
  const { stdout } = await execFileAsync(
    process.execPath,
    [
      "-e",
      "const { SerialPort } = require('serialport'); SerialPort.list().then((ports) => process.stdout.write(JSON.stringify(ports)));",
    ],
    {
      cwd: process.cwd(),
      timeout: 8_000,
      maxBuffer: 256 * 1024,
    },
  );
  const parsed = JSON.parse(stdout) as SerialPortInfo[];
  const ports = Array.isArray(parsed) ? parsed : [];
  return ports.map((port) => ({
    ...port,
    path: preferCalloutPath(port.path),
  }));
}

function isLikelyNiimbotPort(port: SerialPortInfo) {
  const vendorId = port.vendorId?.toLowerCase().padStart(4, "0");
  const productId = port.productId?.toLowerCase().padStart(4, "0");
  return (
    (vendorId === niimbotVendorId && productId === niimbotProductId) ||
    port.path.startsWith("/dev/cu.usbmodem")
  );
}

function preferCalloutPath(path: string) {
  if (!path.startsWith("/dev/tty.")) return path;
  return `/dev/cu.${path.slice("/dev/tty.".length)}`;
}

function isLocalStationHost(hostname: string) {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname.endsWith(".localhost")
  );
}

function isHostedRuntime() {
  return Boolean(
    process.env.VERCEL ||
      process.env.AWS_LAMBDA_FUNCTION_NAME ||
      process.env.NEXT_RUNTIME === "edge",
  );
}
