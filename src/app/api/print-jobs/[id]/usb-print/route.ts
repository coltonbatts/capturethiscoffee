import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import {
  ApiError,
  isPrintStationYoloEnabled,
  jsonError,
  requirePrintStationAccess,
} from "@/lib/supabase-server";

const execFileAsync = promisify(execFile);
const workerTimeoutMs = 75_000;

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await requirePrintStationAccess(request);
    const { id } = await context.params;
    const authHeader = request.headers.get("authorization") || "";
    const isYolo = isPrintStationYoloEnabled();
    const body = await safeJson(request);
    const port = stringOrNull(body.port);
    const debug = body.debug === true;
    const dryRun = body.dry_run === true;
    const scriptPath = path.join(process.cwd(), "scripts", "label-serial-worker.mjs");
    const args = [scriptPath, "--once", `--job-id=${id}`];

    if (debug) args.push("--debug");
    if (dryRun) args.push("--dry-run");
    if (port) args.push(port);

    const { stdout, stderr } = await execFileAsync(process.execPath, args, {
      cwd: process.cwd(),
      timeout: workerTimeoutMs,
      maxBuffer: 1024 * 1024,
      env: {
        ...process.env,
        LABEL_SERIAL_AUTH_TOKEN: isYolo
          ? "print-station-yolo"
          : authHeader.replace(/^Bearer\s+/i, ""),
        LABEL_SERIAL_YOLO: isYolo ? "true" : "",
        LABEL_SERIAL_API_BASE_URL: process.env.LABEL_SERIAL_API_BASE_URL || appBaseUrl(request),
      },
    });

    return Response.json({
      ok: true,
      stdout: trimOutput(stdout),
      stderr: trimOutput(stderr),
    });
  } catch (error) {
    if (isExecError(error)) {
      if (isTimeoutError(error)) {
        return jsonError(
          new ApiError(
            "USB print timed out — check the printer's cable and power, then retry, or use browser print / PNG download instead.",
            504,
          ),
        );
      }
      return jsonError(
        new ApiError(
          trimOutput(error.stderr || error.stdout || error.message) ||
            "USB print worker failed.",
          500,
        ),
      );
    }
    return jsonError(error);
  }
}

async function safeJson(request: Request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

function appBaseUrl(request: Request) {
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
}

function stringOrNull(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function trimOutput(value: string) {
  return value.trim().slice(-8000);
}

function isExecError(
  error: unknown,
): error is Error & { stdout?: string; stderr?: string } {
  return error instanceof Error && ("stdout" in error || "stderr" in error);
}

function isTimeoutError(error: Error & { killed?: boolean; code?: unknown }) {
  return (
    error.killed === true ||
    error.code === "ETIMEDOUT" ||
    /ETIMEDOUT/i.test(error.message)
  );
}
