"use client";

import Link from "next/link";
import {
  CheckCircle2,
  Download,
  ExternalLink,
  Printer,
  RefreshCw,
  RotateCcw,
  XCircle,
} from "lucide-react";
import {
  type CSSProperties,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { AppShell } from "@/components/app-shell";
import {
  PrintableLabel,
  ScreenLabel,
} from "@/components/coffee-label-renderer";
import {
  Panel,
  dangerButtonClass,
  inputClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/ui";
import { getAppAccessToken } from "@/lib/auth";
import { describeDataError } from "@/lib/data";
import {
  loadPrintCalibration,
  type PrintCalibration,
} from "@/lib/label-calibration";
import type { CoffeeLabel } from "@/lib/label-copy";
import {
  niimbotM2ExportFileName,
  niimbotM2ExportPreset,
  renderNiimbotM2LabelPngBlob,
} from "@/lib/niimbot-m2-export";
import { canMarkLabelPrintJobPrinted } from "@/lib/print-jobs";
import type {
  LabelPrintAttemptStatus,
  LabelPrintJobStatus,
  LabelPrintTransport,
} from "@/lib/print-jobs";
import {
  getSupabaseBrowserClient,
  isSupabaseConfigured,
  type Database,
} from "@/lib/supabase";

type PrintJobRow = Database["public"]["Tables"]["label_print_jobs"]["Row"];
type PrintAttemptRow =
  Database["public"]["Tables"]["label_print_attempts"]["Row"];
type StationJob = PrintJobRow & {
  label_print_attempts?: PrintAttemptRow[];
};
type LocalUsbReadiness = {
  ok: boolean;
  local: boolean;
  configuredPort: string;
  configuredPortVisible?: boolean;
  ports: string[];
  message: string;
};
type PersistedPrinterStatus = {
  connected: boolean;
  deviceName: string;
  message: string;
  checkedAt: number;
};
type PrintSheetStyle = CSSProperties &
  Record<
    "--m2-print-offset-x" | "--m2-print-offset-y" | "--m2-print-scale",
    string
  >;

const pollingMs = 3500;
const isPrintStationYolo = process.env.NEXT_PUBLIC_PRINT_STATION_YOLO === "true";
const connectionLostMessage =
  "Connection lost — showing the last loaded queue. Retrying automatically.";
const printerStatusStorageKey = "capturethiscoffee.niimbot-status";
const printerStatusEvent = "capturethiscoffee:niimbot-status";
const unknownPrinterStatus: PersistedPrinterStatus = {
  connected: false,
  deviceName: "",
  message: "",
  checkedAt: 0,
};

export default function LabelStationPage() {
  const [queuedJobs, setQueuedJobs] = useState<StationJob[]>([]);
  const [activeJobs, setActiveJobs] = useState<StationJob[]>([]);
  const [selectedJobId, setSelectedJobId] = useState("");
  const [printLabels, setPrintLabels] = useState<CoffeeLabel[]>([]);
  const [currentAttemptId, setCurrentAttemptId] = useState("");
  const [batchJobs, setBatchJobs] = useState<StationJob[]>([]);
  const [batchAttemptIds, setBatchAttemptIds] = useState<Record<string, string>>({});
  const [transport, setTransport] =
    useState<Extract<LabelPrintTransport, "laptop_browser" | "laptop_usb">>(
      "laptop_browser",
    );
  const [hostName] = useState(() =>
    typeof window === "undefined" ? "" : window.location.hostname,
  );
  const [localUsbReadiness, setLocalUsbReadiness] =
    useState<LocalUsbReadiness | null>(null);
  const [checkingLocalUsb, setCheckingLocalUsb] = useState(false);
  const [browserPrinterStatus, setBrowserPrinterStatus] =
    useState<PersistedPrinterStatus>(loadBrowserPrinterStatus);
  const [calibration] = useState<PrintCalibration>(loadPrintCalibration);
  const [printerName, setPrinterName] = useState("NIIMBOT M2");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const isLocalStation = hostName ? isLocalStationHost(hostName) : false;
  const canPrintViaUsb = isLocalStation && localUsbReadiness?.ok === true;
  const localStationUrl = "http://localhost:3000/labels/station";

  const jobs = useMemo(
    () => [...activeJobs, ...queuedJobs],
    [activeJobs, queuedJobs],
  );
  const selectedJob = useMemo(
    () => jobs.find((job) => job.id === selectedJobId) || activeJobs[0] || queuedJobs[0],
    [activeJobs, jobs, queuedJobs, selectedJobId],
  );
  const queuedCount = queuedJobs.length;
  const activeCount = activeJobs.length;
  const batchCount = batchJobs.length;
  const canMarkSelectedPrinted = selectedJob
    ? canMarkLabelPrintJobPrinted(selectedJob.status)
    : false;
  const nextOperatorStep = getNextOperatorStep({
    batchCount,
    canPrintViaUsb,
    hasJobs: Boolean(jobs.length),
    selectedStatus: selectedJob?.status,
  });
  const printSheetStyle = useMemo<PrintSheetStyle>(
    () => ({
      "--m2-print-offset-x": `${calibration.offsetX}mm`,
      "--m2-print-offset-y": `${calibration.offsetY}mm`,
      "--m2-print-scale": String(calibration.scale / 100),
    }),
    [calibration],
  );

  const refreshJobs = useCallback(async ({ silent = false } = {}) => {
    if (!isSupabaseConfigured && !isPrintStationYolo) {
      setError("Print station requires Supabase auth.");
      return;
    }

    if (!silent) {
      setBusy("refresh");
      setError("");
    }

    try {
      const [queued, claimed, printing] = await Promise.all([
        fetchJobs("queued"),
        fetchJobs("claimed"),
        fetchJobs("printing"),
      ]);
      const nextQueued = queued.jobs || [];
      const nextActive = [...(claimed.jobs || []), ...(printing.jobs || [])];

      setQueuedJobs(nextQueued);
      setActiveJobs(nextActive);
      setSelectedJobId((current) => {
        if (current && [...nextActive, ...nextQueued].some((job) => job.id === current)) {
          return current;
        }
        return nextActive[0]?.id || nextQueued[0]?.id || "";
      });
      // Clear only the connection banner — never an action error the
      // operator is still reading.
      setError((current) => (current === connectionLostMessage ? "" : current));
      if (!silent) setStatus("Queue refreshed.");
    } catch (err) {
      if (silent) {
        // Background poll failed: degrade gracefully. Keep the last known
        // queue on screen and keep retrying instead of replacing it with a
        // raw fetch error.
        setError((current) => current || connectionLostMessage);
      } else {
        setError(describeDataError(err, "Could not load print jobs."));
      }
    } finally {
      if (!silent) setBusy("");
    }
  }, []);

  useEffect(() => {
    const initial = window.setTimeout(() => {
      void refreshJobs();
    }, 0);
    const interval = window.setInterval(() => {
      void refreshJobs({ silent: true });
    }, pollingMs);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(interval);
    };
  }, [refreshJobs]);

  const checkLocalUsbReadiness = useCallback(async () => {
    setCheckingLocalUsb(true);
    try {
      const response = await fetch("/api/print-station/local-readiness");
      const body = (await response.json().catch(() => ({}))) as Partial<LocalUsbReadiness>;
      setLocalUsbReadiness({
        ok: Boolean(body.ok),
        local: Boolean(body.local),
        configuredPort:
          typeof body.configuredPort === "string" ? body.configuredPort : "",
        configuredPortVisible:
          typeof body.configuredPortVisible === "boolean"
            ? body.configuredPortVisible
            : undefined,
        ports: Array.isArray(body.ports)
          ? body.ports.filter((port): port is string => typeof port === "string")
          : [],
        message:
          typeof body.message === "string" && body.message
            ? body.message
            : "Could not verify local USB station readiness.",
      });
    } catch {
      setLocalUsbReadiness({
        ok: false,
        local: false,
        configuredPort: "",
        ports: [],
        message:
          "Could not reach the local station readiness check from this page.",
      });
    } finally {
      setCheckingLocalUsb(false);
    }
  }, []);

  useEffect(() => {
    function syncPrinterStatus() {
      setBrowserPrinterStatus(loadBrowserPrinterStatus());
    }

    window.addEventListener("storage", syncPrinterStatus);
    window.addEventListener(printerStatusEvent, syncPrinterStatus);
    const initialUsbCheck = window.setTimeout(() => {
      void checkLocalUsbReadiness();
    }, 0);

    return () => {
      window.clearTimeout(initialUsbCheck);
      window.removeEventListener("storage", syncPrinterStatus);
      window.removeEventListener(printerStatusEvent, syncPrinterStatus);
    };
  }, [checkLocalUsbReadiness]);

  async function claimNext() {
    const next = queuedJobs[0];
    if (!next) {
      setStatus("No queued labels to claim.");
      return;
    }

    await runJobAction("claim", async () => {
      const body = await apiFetch<{ job: StationJob }>(
        `/api/print-jobs/${next.id}/claim`,
        { method: "POST" },
      );
      setSelectedJobId(body.job.id);
      setStatus(`Claimed ${jobTitle(body.job)}.`);
      await refreshJobs({ silent: true });
    });
  }

  async function printCurrentQueue() {
    if (!queuedJobs.length) {
      setStatus("No queued labels ready.");
      return;
    }

    await runJobAction("batch-print", async () => {
      const body = await apiFetch<{ jobs: StationJob[] }>(
        "/api/print-jobs/batch/claim",
        {
          method: "POST",
          body: JSON.stringify({ job_ids: queuedJobs.map((job) => job.id) }),
        },
      );
      const claimedJobs = sortJobs(body.jobs || []);
      if (!claimedJobs.length) {
        setStatus("No queued labels were available to claim.");
        await refreshJobs({ silent: true });
        return;
      }

      // Attempt rows are bookkeeping. If one fails to record (network blip),
      // keep going — a stuck claimed batch with no print is worse than a
      // missing attempt row. Completion works without an attempt id.
      const attempts: Record<string, string> = {};
      for (const job of claimedJobs) {
        try {
          const attempt = await createAttempt(job.id, "started");
          attempts[job.id] = attempt.id;
        } catch {
          // Best effort — continue with the batch.
        }
      }

      setBatchJobs(claimedJobs);
      setBatchAttemptIds(attempts);
      setSelectedJobId(claimedJobs[0]?.id || "");
      setPrintLabels(claimedJobs.map((job) => job.payload.label));
      setStatus(
        `Printing ${claimedJobs.length} ${claimedJobs.length === 1 ? "label" : "labels"}. Mark batch printed only after the physical labels are correct.`,
      );
      window.setTimeout(() => window.print(), 80);
      await refreshJobs({ silent: true });
    });
  }

  async function printViaBrowser() {
    if (!selectedJob) return;

    await runJobAction("print", async () => {
      const job = await claimIfQueued(selectedJob);
      // Best-effort attempt logging — never block the physical print on it.
      let attemptId = "";
      try {
        const attempt = await createAttempt(job.id, "started");
        attemptId = attempt.id;
      } catch {
        // Continue without an attempt row; completion works without one.
      }
      setCurrentAttemptId(attemptId);
      setSelectedJobId(job.id);
      setPrintLabels([job.payload.label]);
      setStatus(
        `Browser print dialog opening for ${jobTitle(job)}. Mark printed only after the physical label is correct.`,
      );
      window.setTimeout(() => window.print(), 80);
      await refreshJobs({ silent: true });
    });
  }

  async function printViaUsb() {
    if (!selectedJob) return;

    await runJobAction("usb-print", async () => {
      const body = await apiFetch<{ ok: boolean; stdout?: string; stderr?: string }>(
        `/api/print-jobs/${selectedJob.id}/usb-print`,
        { method: "POST" },
      );
      setCurrentAttemptId("");
      setStatus(
        body.ok
          ? `Printed ${jobTitle(selectedJob)} through local USB serial.`
          : "USB print finished without a success response.",
      );
      await refreshJobs({ silent: true });
    });
  }

  async function markPrinted() {
    if (!selectedJob) return;

    await runJobAction("complete", async () => {
      const attemptId =
        currentAttemptId || latestStartedAttempt(selectedJob)?.id || "";
      await apiFetch(`/api/print-jobs/${selectedJob.id}/complete`, {
        method: "POST",
        body: JSON.stringify({ attempt_id: attemptId || null }),
      });
      setCurrentAttemptId("");
      setStatus(`Marked ${jobTitle(selectedJob)} printed.`);
      await refreshJobs({ silent: true });
    });
  }

  async function markBatchPrinted() {
    if (!batchJobs.length) return;

    await runJobAction("batch-complete", async () => {
      await apiFetch("/api/print-jobs/batch/complete", {
        method: "POST",
        body: JSON.stringify({
          jobs: batchJobs.map((job) => ({
            id: job.id,
            attempt_id: batchAttemptIds[job.id] || null,
          })),
        }),
      });
      setStatus(
        `Marked ${batchJobs.length} ${batchJobs.length === 1 ? "label" : "labels"} printed.`,
      );
      setBatchJobs([]);
      setBatchAttemptIds({});
      setCurrentAttemptId("");
      await refreshJobs({ silent: true });
    });
  }

  async function releaseBatch() {
    if (!batchJobs.length) return;

    await runJobAction("batch-release", async () => {
      for (const job of batchJobs) {
        await apiFetch(`/api/print-jobs/${job.id}/fail`, {
          method: "POST",
          body: JSON.stringify({
            release: true,
            error_message: "Batch released by laptop station.",
          }),
        });
      }
      setStatus(
        `Released ${batchJobs.length} ${batchJobs.length === 1 ? "label" : "labels"} back to the queue.`,
      );
      setBatchJobs([]);
      setBatchAttemptIds({});
      setCurrentAttemptId("");
      await refreshJobs({ silent: true });
    });
  }

  async function releaseJob() {
    if (!selectedJob) return;

    await runJobAction("release", async () => {
      await maybeRecordFailureAttempt(selectedJob, "cancelled", "Released for retry.");
      await apiFetch(`/api/print-jobs/${selectedJob.id}/fail`, {
        method: "POST",
        body: JSON.stringify({
          release: true,
          error_message: "Released by laptop station.",
        }),
      });
      setCurrentAttemptId("");
      setStatus(`Released ${jobTitle(selectedJob)} back to the queue.`);
      await refreshJobs({ silent: true });
    });
  }

  async function failJob() {
    if (!selectedJob) return;

    await runJobAction("fail", async () => {
      await maybeRecordFailureAttempt(selectedJob, "failed", "Failed at laptop station.");
      await apiFetch(`/api/print-jobs/${selectedJob.id}/fail`, {
        method: "POST",
        body: JSON.stringify({
          release: false,
          error_message: "Failed at laptop station.",
        }),
      });
      setCurrentAttemptId("");
      setStatus(`Failed ${jobTitle(selectedJob)}.`);
      await refreshJobs({ silent: true });
    });
  }

  async function downloadPng() {
    if (!selectedJob) return;
    await runJobAction("png", async () => {
      const job = await claimIfQueued(selectedJob);
      const blob = await renderNiimbotM2LabelPngBlob(job.payload);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = niimbotM2ExportFileName(jobTitle(job));
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setSelectedJobId(job.id);
      setStatus(
        `Downloaded ${niimbotM2ExportPreset.pixelWidth} x ${niimbotM2ExportPreset.pixelHeight}px ${niimbotM2ExportPreset.label} PNG for ${jobTitle(job)}.`,
      );
      await refreshJobs({ silent: true });
    });
  }

  async function claimIfQueued(job: StationJob) {
    if (job.status !== "queued") return job;

    const body = await apiFetch<{ job: StationJob }>(
      `/api/print-jobs/${job.id}/claim`,
      { method: "POST" },
    );
    return { ...body.job, payload: job.payload };
  }

  async function createAttempt(
    jobId: string,
    attemptStatus: LabelPrintAttemptStatus,
  ) {
    const body = await apiFetch<{ attempt: PrintAttemptRow }>(
      `/api/print-jobs/${jobId}/attempts`,
      {
        method: "POST",
        body: JSON.stringify({
          status: attemptStatus,
          transport,
          printer_name: printerName,
          printer_identifier: "laptop-station",
        }),
      },
    );
    return body.attempt;
  }

  async function maybeRecordFailureAttempt(
    job: StationJob,
    attemptStatus: Extract<LabelPrintAttemptStatus, "failed" | "cancelled">,
    message: string,
  ) {
    if (currentAttemptId || latestStartedAttempt(job)) {
      return;
    }

    try {
      await apiFetch(`/api/print-jobs/${job.id}/attempts`, {
        method: "POST",
        body: JSON.stringify({
          status: attemptStatus,
          transport,
          printer_name: printerName,
          printer_identifier: "laptop-station",
          error_message: message,
        }),
      });
    } catch {
      // Attempt rows are bookkeeping — never let them block releasing or
      // failing a job, or it gets stuck claimed with no recovery path.
    }
  }

  async function runJobAction(name: string, action: () => Promise<void>) {
    setBusy(name);
    setError("");
    try {
      await action();
    } catch (err) {
      setError(describeDataError(err, "Print station action failed."));
    } finally {
      setBusy("");
    }
  }

  return (
    <AppShell
      title="Label print station"
      requireAuth
      actions={
        <Link href="/labels" className={`${secondaryButtonClass} min-h-10 border-zinc-700 bg-zinc-950 px-3 text-white hover:bg-zinc-800`}>
          <ExternalLink size={16} aria-hidden="true" />
          Workstation
        </Link>
      }
    >
      <div className="grid gap-4 no-print">
        <section className="grid gap-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm shadow-black/5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div>
            <h1 className="text-2xl font-black leading-tight tracking-normal text-black md:text-3xl">
              Laptop print station
            </h1>
            <p className="mt-1 text-sm font-medium text-zinc-600">
              Print every queued label in one batch, then record the physical result.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 rounded-xl border border-zinc-200 bg-zinc-50 p-2 text-center">
            <Metric value={queuedCount} label="Queued" />
            <Metric value={activeCount} label="Claimed" />
          </div>
        </section>

        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-800">
            {error}
          </div>
        ) : null}
        {status ? (
          <div className="rounded-xl border border-sky-200 bg-sky-50 p-3 text-sm font-semibold text-sky-950">
            {status}
          </div>
        ) : null}
        <div
          className={`rounded-xl border p-3 text-sm font-semibold ${
            nextOperatorStep.tone === "ready"
              ? "border-emerald-200 bg-emerald-50 text-emerald-950"
              : nextOperatorStep.tone === "warning"
                ? "border-amber-200 bg-amber-50 text-amber-950"
                : "border-zinc-200 bg-zinc-50 text-zinc-700"
          }`}
        >
          <span className="font-black text-black">Next: </span>
          {nextOperatorStep.message}
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(280px,0.8fr)_minmax(360px,1.1fr)_minmax(280px,0.75fr)]">
          <Panel className="grid gap-4 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold">Queue</h2>
                <p className="mt-1 text-sm text-zinc-600">
                  Oldest highest-priority job is claimed first.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void refreshJobs()}
                className={`${secondaryButtonClass} min-w-11 px-3`}
                disabled={Boolean(busy)}
                aria-label="Refresh queue"
              >
                <RefreshCw size={18} aria-hidden="true" />
              </button>
            </div>

            <button
              type="button"
              onClick={() => void printCurrentQueue()}
              className={`${primaryButtonClass} min-h-14 text-base`}
              disabled={!queuedJobs.length || Boolean(busy)}
            >
              <Printer size={18} aria-hidden="true" />
              Print current queue
            </button>
            <p className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm font-black text-zinc-800">
              {queuedCount
                ? `${queuedCount} ${queuedCount === 1 ? "label" : "labels"} ready`
                : "No queued labels yet. Keep this page open; queued labels appear automatically."}
            </p>

            {batchJobs.length ? (
              <div className="grid gap-2 rounded-xl border border-sky-200 bg-sky-50 p-3">
                <p className="text-sm font-black text-sky-950">
                  Batch in progress: {batchCount}{" "}
                  {batchCount === 1 ? "label" : "labels"}
                </p>
                <button
                  type="button"
                  onClick={() => void markBatchPrinted()}
                  disabled={Boolean(busy)}
                  className={`${primaryButtonClass} min-h-12`}
                >
                  <CheckCircle2 size={18} aria-hidden="true" />
                  Mark batch physically printed
                </button>
                <p className="text-xs font-bold text-sky-950">
                  Use only after every label in this batch is on stock, readable,
                  and not clipped.
                </p>
                <button
                  type="button"
                  onClick={() => void releaseBatch()}
                  disabled={Boolean(busy)}
                  className={`${secondaryButtonClass} min-h-11`}
                >
                  <RotateCcw size={18} aria-hidden="true" />
                  Release batch
                </button>
              </div>
            ) : null}

            <button
              type="button"
              onClick={() => void claimNext()}
              className={`${secondaryButtonClass} min-h-11`}
              disabled={!queuedJobs.length || Boolean(busy)}
            >
              <Printer size={18} aria-hidden="true" />
              Claim one
            </button>

            <JobList
              title="Claimed or printing"
              jobs={activeJobs}
              selectedJobId={selectedJob?.id || ""}
              onSelect={setSelectedJobId}
            />
            <JobList
              title="Queued"
              jobs={queuedJobs}
              selectedJobId={selectedJob?.id || ""}
              onSelect={setSelectedJobId}
            />
          </Panel>

          <Panel className="grid gap-4 p-4">
            <div>
              <h2 className="text-lg font-bold">
                {batchJobs.length ? "Current batch" : "Current label"}
              </h2>
              <p className="mt-1 text-sm text-zinc-600">
                {batchJobs.length
                  ? `${batchJobs.length} labels claimed for this print batch.`
                  : "50mm x 30mm snapshot from the stored print-job payload."}
              </p>
            </div>

            <div className="grid min-h-[280px] place-items-center overflow-hidden rounded-2xl border border-zinc-200 bg-[linear-gradient(135deg,#f8fafc_0%,#f8fafc_48%,#eef2f7_48%,#eef2f7_52%,#f8fafc_52%)] p-3 sm:min-h-[340px] sm:p-4">
              {batchJobs.length ? (
                <div className="grid max-h-[420px] w-full grid-cols-1 gap-3 overflow-auto p-1 sm:grid-cols-2">
                  {batchJobs.map((job) => (
                    <ScreenLabel key={job.id} label={job.payload.label} />
                  ))}
                </div>
              ) : selectedJob ? (
                <ScreenLabel label={selectedJob.payload.label} />
              ) : (
                <p className="text-sm font-semibold text-zinc-500">
                  No label selected.
                </p>
              )}
            </div>

            {selectedJob ? (
              <div className="grid gap-2">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => void printViaUsb()}
                    disabled={Boolean(busy) || !canPrintViaUsb}
                    className={`${primaryButtonClass} col-span-2 min-h-14 text-base`}
                  >
                    <Printer size={19} aria-hidden="true" />
                    Print via USB
                  </button>
                  {!isLocalStation ? (
                    <p className="col-span-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-950">
                      {browserPrinterStatus.connected
                        ? `Printer is visible to this browser as ${browserPrinterStatus.deviceName || "NIIMBOT"}, but USB printing requires the local station server. Open ${localStationUrl} on this laptop.`
                        : `USB printing is local-only. Open ${localStationUrl} on the printer laptop to use the attached NIIMBOT.`}
                    </p>
                  ) : null}
                  {isLocalStation && !canPrintViaUsb ? (
                    <div className="col-span-2 grid gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-950">
                      <p>
                        {localUsbReadiness?.message ||
                          "Checking whether the local station server can see the NIIMBOT USB port."}
                      </p>
                      <p className="font-black">
                        Do not mark printed from USB until a physical label comes
                        out correctly. Use browser print or PNG export as the
                        fallback.
                      </p>
                      <button
                        type="button"
                        onClick={() => void checkLocalUsbReadiness()}
                        disabled={checkingLocalUsb || Boolean(busy)}
                        className={`${secondaryButtonClass} min-h-10 justify-self-start border-amber-300 bg-white px-3 text-amber-950 hover:bg-amber-100`}
                      >
                        <RefreshCw size={16} aria-hidden="true" />
                        {checkingLocalUsb ? "Checking USB..." : "Recheck USB"}
                      </button>
                    </div>
                  ) : null}
                  {canPrintViaUsb && localUsbReadiness ? (
                    <p className="col-span-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-950">
                      {localUsbReadiness.message}
                    </p>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => void printViaBrowser()}
                    disabled={Boolean(busy)}
                    className={`${secondaryButtonClass} min-h-14`}
                  >
                    <Printer size={19} aria-hidden="true" />
                    Print via browser
                  </button>
                  <button
                    type="button"
                    onClick={() => void downloadPng()}
                    disabled={Boolean(busy)}
                    className={`${secondaryButtonClass} min-h-14`}
                  >
                    <Download size={18} aria-hidden="true" />
                    Export NIIMBOT M2 PNG
                  </button>
                  <p className="col-span-2 rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm font-semibold text-zinc-700">
                    Browser print and PNG export both claim a queued label. The
                    job is not complete until you inspect the physical output and
                    click Mark physically printed.
                  </p>
                  <button
                    type="button"
                    onClick={() => void markPrinted()}
                    disabled={Boolean(busy) || !canMarkSelectedPrinted}
                    className={`${primaryButtonClass} min-h-14`}
                  >
                    <CheckCircle2 size={18} aria-hidden="true" />
                    Mark physically printed
                  </button>
                  <button
                    type="button"
                    onClick={() => void releaseJob()}
                    disabled={Boolean(busy) || selectedJob.status === "queued"}
                    className={`${secondaryButtonClass} min-h-14`}
                  >
                    <RotateCcw size={18} aria-hidden="true" />
                    Release/retry
                  </button>
                  <button
                    type="button"
                    onClick={() => void failJob()}
                    disabled={Boolean(busy) || selectedJob.status === "queued"}
                    className={`${dangerButtonClass} min-h-14`}
                  >
                    <XCircle size={18} aria-hidden="true" />
                    Fail
                  </button>
                </div>
                {selectedJob.status === "queued" ? (
                  <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-950">
                    Browser print and PNG export will claim this label
                    automatically. Mark physically printed stays locked until
                    the label is claimed and physically printed.
                  </p>
                ) : null}
              </div>
            ) : null}
          </Panel>

          <Panel className="grid content-start gap-4 p-4">
            <div>
              <h2 className="text-lg font-bold">Print path</h2>
              <p className="mt-1 text-sm text-zinc-600">
                USB serial is primary only when this page is served by the local
                station server; browser print remains the fallback.
              </p>
            </div>

            <label className="grid gap-1.5 text-sm font-medium text-zinc-600">
              Transport
              <select
                className={inputClass}
                value={transport}
                onChange={(event) =>
                  setTransport(
                    event.target.value as Extract<
                      LabelPrintTransport,
                      "laptop_browser" | "laptop_usb"
                    >,
                  )
                }
              >
                <option value="laptop_browser">Laptop browser</option>
                <option value="laptop_usb">Laptop USB / desktop app</option>
              </select>
            </label>
            <label className="grid gap-1.5 text-sm font-medium text-zinc-600">
              Printer name
              <input
                className={inputClass}
                value={printerName}
                onChange={(event) => setPrinterName(event.target.value)}
              />
            </label>

            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm font-medium leading-6 text-zinc-700">
              <p className="font-bold text-black">Operational path</p>
              <ul className="mt-1 list-disc space-y-1 pl-5">
                <li>USB: use first only when the readiness message is green.</li>
                <li>Bluetooth check: proves only that this browser can see the printer.</li>
                <li>Browser fallback: choose the NIIMBOT driver, 50mm x 30mm, 100% scale, no fit-to-page.</li>
                <li>
                  PNG fallback: save the downloaded{" "}
                  {niimbotM2ExportPreset.pixelWidth} x{" "}
                  {niimbotM2ExportPreset.pixelHeight} image and import it into
                  the NIIMBOT mobile app.
                </li>
                <li>
                  Core label content stays inside a{" "}
                  {niimbotM2ExportPreset.safeMarginPx}px safe margin for the
                  50mm x 30mm preset.
                </li>
                <li>Only mark printed after the physical M2 label is correct.</li>
              </ul>
            </div>

            {selectedJob ? (
              <div className="rounded-xl border border-zinc-200 bg-white p-3 text-sm">
                <p className="font-bold text-black">{jobTitle(selectedJob)}</p>
                <p className="mt-1 text-zinc-600">{selectedJob.payload.label.drink}</p>
                <p className="mt-2 font-mono text-xs text-zinc-500">
                  {selectedJob.id.slice(0, 8)} - {selectedJob.status}
                </p>
                <p className="mt-1 text-xs font-semibold text-zinc-500">
                  Attempts: {selectedJob.label_print_attempts?.length || 0}
                </p>
              </div>
            ) : null}
          </Panel>
        </div>
      </div>

      <section className="print-only hidden">
        <div className="m2-label-sheet" style={printSheetStyle}>
          {(printLabels.length
            ? printLabels
            : selectedJob
              ? [selectedJob.payload.label]
              : []
          ).map((label) => (
            <PrintableLabel key={label.id} label={label} />
          ))}
        </div>
      </section>
    </AppShell>
  );
}

function JobList({
  title,
  jobs,
  selectedJobId,
  onSelect,
}: {
  title: string;
  jobs: StationJob[];
  selectedJobId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="grid gap-2">
      <h3 className="text-sm font-black uppercase tracking-normal text-zinc-500">
        {title}
      </h3>
      {jobs.length ? (
        <div className="grid gap-2">
          {jobs.map((job) => (
            <button
              key={job.id}
              type="button"
              onClick={() => onSelect(job.id)}
              className={`grid gap-1 rounded-xl border p-3 text-left transition active:scale-[0.99] ${
                job.id === selectedJobId
                  ? "border-black bg-black text-white"
                  : "border-zinc-200 bg-white text-black hover:border-zinc-400"
              }`}
            >
              <span className="flex items-start justify-between gap-3">
                <span className="min-w-0 truncate text-sm font-black">
                  {jobTitle(job)}
                </span>
                <span className="shrink-0 rounded-full bg-zinc-100 px-2 py-1 text-[11px] font-black uppercase text-zinc-700">
                  {job.status}
                </span>
              </span>
              <span
                className={`line-clamp-2 text-xs font-semibold ${
                  job.id === selectedJobId ? "text-zinc-200" : "text-zinc-600"
                }`}
              >
                {job.payload.label.drink}
              </span>
            </button>
          ))}
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-3 text-sm font-medium text-zinc-600">
          None.
        </p>
      )}
    </div>
  );
}

function Metric({ value, label }: { value: number; label: string }) {
  return (
    <div className="min-w-20 rounded-lg bg-white px-3 py-2 ring-1 ring-zinc-200">
      <p className="text-2xl font-black leading-none">{value}</p>
      <p className="mt-1 text-xs font-semibold text-zinc-500">{label}</p>
    </div>
  );
}

function sortJobs(jobs: StationJob[]) {
  return [...jobs].sort((a, b) => {
    const priority = b.priority - a.priority;
    if (priority) return priority;
    return a.created_at.localeCompare(b.created_at);
  });
}

function getNextOperatorStep({
  batchCount,
  canPrintViaUsb,
  hasJobs,
  selectedStatus,
}: {
  batchCount: number;
  canPrintViaUsb: boolean;
  hasJobs: boolean;
  selectedStatus?: LabelPrintJobStatus;
}) {
  if (batchCount > 0) {
    return {
      tone: "warning" as const,
      message:
        "Inspect every label in the batch. Mark batch physically printed only if all labels are correct; otherwise release the batch.",
    };
  }

  if (!hasJobs) {
    return {
      tone: "idle" as const,
      message:
        "Waiting for queued labels. Use the workstation to queue labels, or keep this station open for automatic refresh.",
    };
  }

  if (selectedStatus === "queued") {
    return {
      tone: canPrintViaUsb ? "ready" as const : "warning" as const,
      message: canPrintViaUsb
        ? "Print via USB. If USB fails, use browser print or PNG export; this label will be claimed automatically."
        : "USB is not ready. Use browser print or PNG export, then confirm only after the physical label is correct.",
    };
  }

  if (selectedStatus === "claimed" || selectedStatus === "printing") {
    return {
      tone: "warning" as const,
      message:
        "A label is in progress. Mark physically printed only after the stock output is readable, correctly scaled, and not clipped.",
    };
  }

  return {
    tone: "idle" as const,
    message: "Refresh the queue or select a label to continue.",
  };
}

async function fetchJobs(status: LabelPrintJobStatus) {
  return apiFetch<{ jobs: StationJob[] }>(
    `/api/print-jobs?status=${encodeURIComponent(status)}&limit=25`,
  );
}

async function apiFetch<T = unknown>(path: string, init: RequestInit = {}) {
  const token = await getAccessToken();
  const response = await fetch(path, {
    ...init,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  });
  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      typeof body.error === "string" ? body.error : "Print station request failed.",
    );
  }

  return body as T;
}

async function getAccessToken() {
  if (isPrintStationYolo) return "";
  const supabase = getSupabaseBrowserClient();
  if (!supabase) throw new Error("Supabase auth is not available.");
  return getAppAccessToken(supabase);
}

function latestStartedAttempt(job: StationJob) {
  return [...(job.label_print_attempts || [])]
    .filter((attempt) => attempt.status === "started")
    .sort((a, b) => b.started_at.localeCompare(a.started_at))[0];
}

function isLocalStationHost(hostname: string) {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname.endsWith(".localhost")
  );
}

function loadBrowserPrinterStatus(): PersistedPrinterStatus {
  if (typeof window === "undefined") return unknownPrinterStatus;

  try {
    const raw = window.localStorage.getItem(printerStatusStorageKey);
    if (!raw) return unknownPrinterStatus;

    const parsed = JSON.parse(raw) as Partial<PersistedPrinterStatus>;
    return {
      connected: Boolean(parsed.connected),
      deviceName: typeof parsed.deviceName === "string" ? parsed.deviceName : "",
      message: typeof parsed.message === "string" ? parsed.message : "",
      checkedAt: typeof parsed.checkedAt === "number" ? parsed.checkedAt : 0,
    };
  } catch {
    return unknownPrinterStatus;
  }
}

function jobTitle(job: StationJob) {
  return job.payload.label.personName || job.payload.label.title || "Cup label";
}
