"use client";

import Link from "next/link";
import { Bluetooth, ChevronDown, ChevronUp, CircleAlert, CircleCheckBig, Printer } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  connectNiimbotBluetooth,
  isWebBluetoothAvailable,
} from "@/lib/niimbot-web-bluetooth";

type PersistedPrinterStatus = {
  connected: boolean;
  deviceName: string;
  message: string;
  checkedAt: number;
};

const printerStatusStorageKey = "capturethiscoffee.niimbot-status";
const printerStatusEvent = "capturethiscoffee:niimbot-status";
const printerCalloutCollapsedKey = "capturethiscoffee.print-callout-collapsed";

const unknownStatus: PersistedPrinterStatus = {
  connected: false,
  deviceName: "",
  message: "NIIMBOT status not checked on this device yet.",
  checkedAt: 0,
};

export function PrinterStationCallout() {
  const [status, setStatus] = useState<PersistedPrinterStatus>(unknownStatus);
  const [checking, setChecking] = useState(false);
  const [localStationUrl, setLocalStationUrl] = useState("/labels/station");
  const [collapsed, setCollapsed] = useState(false);
  const [browserReady, setBrowserReady] = useState(false);
  const disconnectCleanupRef = useRef<(() => void) | null>(null);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      window.localStorage.setItem(printerCalloutCollapsedKey, String(next));
      return next;
    });
  }

  useEffect(() => {
    function syncStatus() {
      setStatus(loadPrinterStatus());
    }

    const hydrationFrame = window.requestAnimationFrame(() => {
      setBrowserReady(true);
      setLocalStationUrl(getLocalStationUrl());
      setCollapsed(
        window.localStorage.getItem(printerCalloutCollapsedKey) === "true",
      );
      syncStatus();
    });

    window.addEventListener("storage", syncStatus);
    window.addEventListener(printerStatusEvent, syncStatus);

    return () => {
      window.cancelAnimationFrame(hydrationFrame);
      window.removeEventListener("storage", syncStatus);
      window.removeEventListener(printerStatusEvent, syncStatus);
      disconnectCleanupRef.current?.();
    };
  }, []);

  async function checkPrinter() {
    if (checking) return;

    setChecking(true);

    try {
      const connection = await connectNiimbotBluetooth();
      const nextStatus: PersistedPrinterStatus = {
        connected: true,
        deviceName: connection.deviceName,
        message: `Connected to ${connection.deviceName}.`,
        checkedAt: Date.now(),
      };

      persistPrinterStatus(nextStatus);
      disconnectCleanupRef.current?.();

      const handleDisconnect = () => {
        persistPrinterStatus({
          connected: false,
          deviceName: connection.deviceName,
          message: `${connection.deviceName} disconnected.`,
          checkedAt: Date.now(),
        });
      };

      connection.device.addEventListener?.("gattserverdisconnected", handleDisconnect);
      disconnectCleanupRef.current = () => {
        connection.device.removeEventListener?.(
          "gattserverdisconnected",
          handleDisconnect,
        );
      };
    } catch (err) {
      persistPrinterStatus({
        connected: false,
        deviceName: "",
        message:
          err instanceof Error
            ? err.message
            : "Could not connect to the NIIMBOT printer.",
        checkedAt: Date.now(),
      });
    } finally {
      setChecking(false);
    }
  }

  const statusTone = status.connected
    ? "border-white bg-white text-black"
    : "border-zinc-500 bg-black text-white";
  const StatusIcon = status.connected ? CircleCheckBig : CircleAlert;
  const checkedLabel = status.checkedAt
    ? `Last checked ${new Date(status.checkedAt).toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
      })}`
    : "Needs printer check";

  if (collapsed) {
    return (
      <section className="border-b border-black bg-black text-white no-print">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2">
          <div className="flex items-center gap-2.5">
            <Printer size={15} className="shrink-0 text-white" aria-hidden="true" />
            <span className="text-xs font-black uppercase tracking-normal text-white">
              Print Station
            </span>
            <span
              className={`inline-flex min-h-6 items-center gap-1.5 rounded-md border px-2 text-xs font-black ${statusTone}`}
            >
              <StatusIcon size={12} aria-hidden="true" />
              {status.connected
                ? `${status.deviceName || "NIIMBOT"} connected`
                : "Not connected"}
            </span>
          </div>
          <button
            type="button"
            onClick={toggleCollapsed}
            className="grid size-8 place-items-center rounded-lg text-zinc-300 hover:bg-white hover:text-black"
            aria-label="Expand print station"
          >
            <ChevronDown size={16} aria-hidden="true" />
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="border-b border-black bg-black text-white no-print">
      <div className="mx-auto grid max-w-6xl gap-3 px-4 py-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <div className="grid gap-3 lg:grid-cols-[auto_minmax(0,1fr)] lg:items-center">
          <div className="flex size-14 items-center justify-center rounded-xl border border-white bg-white text-black">
            <Printer size={28} aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-black uppercase tracking-normal text-zinc-300">
                Print Station
              </p>
              <button
                type="button"
                onClick={toggleCollapsed}
                className="grid size-8 place-items-center rounded-lg text-zinc-300 hover:bg-white hover:text-black lg:hidden"
                aria-label="Collapse print station"
              >
                <ChevronUp size={16} aria-hidden="true" />
              </button>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span className="text-lg font-black leading-tight md:text-xl">
                Open the laptop print station fast.
              </span>
              <span
                className={`inline-flex min-h-8 items-center gap-2 rounded-md border px-3 py-1 text-xs font-black ${statusTone}`}
              >
                <StatusIcon size={14} aria-hidden="true" />
                {status.connected
                  ? `${status.deviceName || "NIIMBOT"} connected`
                  : "NIIMBOT not connected"}
              </span>
            </div>
            <p className="mt-1 text-sm font-medium text-zinc-300">
              {status.message} {checkedLabel}.
            </p>
            {status.connected && localStationUrl.startsWith("http://localhost") ? (
              <p className="mt-1 text-sm font-semibold text-zinc-200">
                Printer is visible to this browser, but USB printing requires the
                local station server on the printer laptop.
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row lg:items-center">
          <button
            type="button"
            onClick={toggleCollapsed}
            className="hidden size-10 place-items-center rounded-lg text-zinc-300 hover:bg-white hover:text-black lg:grid"
            aria-label="Collapse print station"
          >
            <ChevronUp size={16} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => void checkPrinter()}
            disabled={checking || !browserReady || !isWebBluetoothAvailable()}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-white bg-black px-4 text-sm font-black leading-tight text-white transition hover:bg-zinc-900 active:translate-y-px disabled:cursor-not-allowed disabled:border-zinc-700 disabled:text-zinc-500"
          >
            <Bluetooth size={18} aria-hidden="true" />
            {checking ? "Checking NIIMBOT..." : "Check NIIMBOT"}
          </button>
          <Link
            href={localStationUrl}
            className="inline-flex min-h-14 items-center justify-center gap-2 rounded-lg border border-white bg-white px-6 text-base font-black text-black transition hover:bg-zinc-200 active:translate-y-px"
          >
            <Printer size={18} aria-hidden="true" />
            {localStationUrl.startsWith("http://localhost")
              ? "Open Local Station"
              : "Open Print Station"}
          </Link>
        </div>
      </div>
    </section>
  );
}

function loadPrinterStatus(): PersistedPrinterStatus {
  if (typeof window === "undefined") return unknownStatus;

  try {
    const raw = window.localStorage.getItem(printerStatusStorageKey);
    if (!raw) return unknownStatus;

    const parsed = JSON.parse(raw) as Partial<PersistedPrinterStatus>;
    return {
      connected: Boolean(parsed.connected),
      deviceName: typeof parsed.deviceName === "string" ? parsed.deviceName : "",
      message:
        typeof parsed.message === "string" && parsed.message
          ? parsed.message
          : unknownStatus.message,
      checkedAt: typeof parsed.checkedAt === "number" ? parsed.checkedAt : 0,
    };
  } catch {
    return unknownStatus;
  }
}

function persistPrinterStatus(status: PersistedPrinterStatus) {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(printerStatusStorageKey, JSON.stringify(status));
  window.dispatchEvent(new Event(printerStatusEvent));
}

function getLocalStationUrl() {
  if (typeof window === "undefined") return "/labels/station";
  return isLocalStationHost(window.location.hostname)
    ? "/labels/station"
    : "http://localhost:3000/labels/station";
}

function isLocalStationHost(hostname: string) {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname.endsWith(".localhost")
  );
}
