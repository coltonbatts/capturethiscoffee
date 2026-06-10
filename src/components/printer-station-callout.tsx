"use client";

import Link from "next/link";
import { Bluetooth, CircleAlert, CircleCheckBig, Printer } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { secondaryButtonClass } from "@/components/ui";
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

const unknownStatus: PersistedPrinterStatus = {
  connected: false,
  deviceName: "",
  message: "NIIMBOT status not checked on this device yet.",
  checkedAt: 0,
};

export function PrinterStationCallout() {
  const [status, setStatus] = useState<PersistedPrinterStatus>(loadPrinterStatus);
  const [checking, setChecking] = useState(false);
  const disconnectCleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    function syncStatus() {
      setStatus(loadPrinterStatus());
    }

    window.addEventListener("storage", syncStatus);
    window.addEventListener(printerStatusEvent, syncStatus);

    return () => {
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
    ? "border-emerald-300 bg-emerald-50 text-emerald-950"
    : "border-amber-300 bg-amber-50 text-amber-950";
  const StatusIcon = status.connected ? CircleCheckBig : CircleAlert;
  const checkedLabel = status.checkedAt
    ? `Last checked ${new Date(status.checkedAt).toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
      })}`
    : "Needs printer check";

  return (
    <section className="border-b border-zinc-800 bg-[linear-gradient(135deg,#18181b_0%,#18181b_44%,#27272a_44%,#27272a_100%)] text-white no-print">
      <div className="mx-auto grid max-w-6xl gap-3 px-4 py-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <div className="grid gap-3 lg:grid-cols-[auto_minmax(0,1fr)] lg:items-center">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-white text-black shadow-sm">
            <Printer size={28} aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-[0.24em] text-amber-300">
              Print Station
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span className="text-lg font-black leading-tight md:text-xl">
                Open the laptop print station fast.
              </span>
              <span
                className={`inline-flex min-h-8 items-center gap-2 rounded-full border px-3 py-1 text-xs font-black ${statusTone}`}
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
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={() => void checkPrinter()}
            disabled={checking || !isWebBluetoothAvailable()}
            className={`${secondaryButtonClass} min-h-12 border-zinc-600 bg-zinc-950 px-4 text-white hover:bg-zinc-800 disabled:border-zinc-800 disabled:bg-zinc-900`}
          >
            <Bluetooth size={18} aria-hidden="true" />
            {checking ? "Checking NIIMBOT..." : "Check NIIMBOT"}
          </button>
          <Link
            href="/labels/station"
            className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-amber-300 px-6 text-base font-black text-black shadow-[0_10px_30px_rgba(251,191,36,0.28)] transition hover:bg-amber-200 active:scale-[0.99]"
          >
            <Printer size={18} aria-hidden="true" />
            Open Print Station
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
