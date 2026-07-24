/** Thin wrapper around tools/vision-barcode (macOS + Swift toolchain only). */

import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

export function visionToolAvailable() {
  if (process.platform !== "darwin") return false;
  try {
    execFileSync("which", ["swiftc"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

export function buildVisionTool(workDir) {
  if (!visionToolAvailable()) {
    throw new Error(
      "Vision verification needs macOS with the Swift toolchain (swiftc).",
    );
  }

  const source = join(process.cwd(), "tools", "vision-barcode", "main.swift");
  if (!existsSync(source)) {
    throw new Error(`Missing ${source}`);
  }

  const binary = join(workDir, "vision-barcode");
  execFileSync("swiftc", ["-O", source, "-o", binary], { stdio: "inherit" });
  return binary;
}

export function decodeWithVision(binary, imagePath) {
  const output = execFileSync(binary, [imagePath], { encoding: "utf8" });
  return output
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}
