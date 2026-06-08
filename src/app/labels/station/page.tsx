"use client";

import Link from "next/link";
import {
  CheckCircle2,
  ExternalLink,
  Printer,
  RefreshCw,
  RotateCcw,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
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
import type { CoffeeLabel } from "@/lib/label-copy";
import type {
  LabelPrintAttemptStatus,
  LabelPrintJobStatus,
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

const pollingMs = 3500;

export default function LabelStationPage() {
  const [queuedJobs, setQueuedJobs] = useState<StationJob[]>([]);
  const [activeJobs, setActiveJobs] = useState<StationJob[]>([]);
  const [selectedJobId, setSelectedJobId] = useState("");
  const [printLabels, setPrintLabels] = useState<CoffeeLabel[]>([]);
  const [currentAttemptId, setCurrentAttemptId] = useState("");
  const [printerName, setPrinterName] = useState("NIIMBOT M2");
  const [failureReason, setFailureReason] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

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
  const nextQueuedJob = queuedJobs[0];
  const canPrintSelected =
    selectedJob?.status === "claimed" || selectedJob?.status === "printing";
  const primaryJob = canPrintSelected ? selectedJob : nextQueuedJob;

  const refreshJobs = useCallback(async ({ silent = false } = {}) => {
    if (!isSupabaseConfigured) {
      setError("Print station requires Supabase auth.");
      return;
    }

    if (!silent) setBusy("refresh");
    setError("");

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
      if (!silent) setStatus("Queue refreshed.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load print jobs.");
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

  async function claimJob(job: StationJob) {
    const body = await apiFetch<{ job: StationJob }>(
      `/api/print-jobs/${job.id}/claim`,
      { method: "POST" },
    );
    setSelectedJobId(body.job.id);
    return body.job;
  }

  async function printNextLabel() {
    const jobToPrint = primaryJob;
    if (!jobToPrint) {
      setStatus("No queued labels to print.");
      return;
    }

    await runJobAction("print", async () => {
      const claimedJob =
        jobToPrint.status === "queued" ? await claimJob(jobToPrint) : jobToPrint;
      await printJob(claimedJob);
    });
  }

  async function claimNext() {
    const next = queuedJobs[0];
    if (!next) {
      setStatus("No queued labels to claim.");
      return;
    }

    await runJobAction("claim", async () => {
      const job = await claimJob(next);
      setStatus(`Claimed ${jobTitle(job)}.`);
      await refreshJobs({ silent: true });
    });
  }

  async function reprintCurrentJob() {
    if (!selectedJob) return;

    await runJobAction("reprint", async () => {
      const job =
        selectedJob.status === "queued" ? await claimJob(selectedJob) : selectedJob;
      await printJob(job);
    });
  }

  async function printJob(job: StationJob) {
    const attempt = await createAttempt(job.id, "started");
    setCurrentAttemptId(attempt.id);
    setSelectedJobId(job.id);
    setPrintLabels([job.payload.label]);
    setStatus(
      "Print dialog opening. Use Mark printed only after the physical label is correct.",
    );
    window.setTimeout(() => window.print(), 80);
    await refreshJobs({ silent: true });
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

  async function releaseJob() {
    if (!selectedJob) return;

    await runJobAction("release", async () => {
      const reason = failureReason.trim() || "Skipped at laptop station.";
      const attemptId = currentAttemptId || latestStartedAttempt(selectedJob)?.id || "";
      await maybeRecordFailureAttempt(selectedJob, "cancelled", reason);
      await apiFetch(`/api/print-jobs/${selectedJob.id}/fail`, {
        method: "POST",
        body: JSON.stringify({
          release: true,
          attempt_id: attemptId || null,
          error_message: reason,
        }),
      });
      setCurrentAttemptId("");
      setFailureReason("");
      setStatus(`Skipped ${jobTitle(selectedJob)} and returned it to the queue.`);
      await refreshJobs({ silent: true });
    });
  }

  async function failJob() {
    if (!selectedJob) return;

    await runJobAction("fail", async () => {
      const reason = failureReason.trim() || "Failed at laptop station.";
      const attemptId = currentAttemptId || latestStartedAttempt(selectedJob)?.id || "";
      await maybeRecordFailureAttempt(selectedJob, "failed", reason);
      await apiFetch(`/api/print-jobs/${selectedJob.id}/fail`, {
        method: "POST",
        body: JSON.stringify({
          release: false,
          attempt_id: attemptId || null,
          error_message: reason,
        }),
      });
      setCurrentAttemptId("");
      setFailureReason("");
      setStatus(`Failed ${jobTitle(selectedJob)}.`);
      await refreshJobs({ silent: true });
    });
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
          transport: "laptop_browser",
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

    await apiFetch(`/api/print-jobs/${job.id}/attempts`, {
      method: "POST",
      body: JSON.stringify({
        status: attemptStatus,
        transport: "laptop_browser",
        printer_name: printerName,
        printer_identifier: "laptop-station",
        error_message: message,
      }),
    });
  }

  async function runJobAction(name: string, action: () => Promise<void>) {
    setBusy(name);
    setError("");
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Print station action failed.");
    } finally {
      setBusy("");
    }
  }

  return (
    <AppShell
      title="Label print station"
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
              Keep this page open on the printer laptop. Print the next queued
              label, then confirm the physical result.
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

        <div className="grid gap-4 xl:grid-cols-[minmax(360px,1.2fr)_minmax(280px,0.85fr)]">
          <Panel className="grid gap-4 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold">Next label</h2>
                <p className="mt-1 text-sm text-zinc-600">
                  Highest priority and oldest created job prints first.
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

            <div className="grid min-h-[320px] place-items-center overflow-hidden rounded-2xl border-2 border-black bg-[linear-gradient(135deg,#f8fafc_0%,#f8fafc_48%,#eef2f7_48%,#eef2f7_52%,#f8fafc_52%)] p-4 sm:min-h-[390px]">
              {primaryJob ? (
                <div className="grid gap-3">
                  <ScreenLabel label={primaryJob.payload.label} />
                  <div className="text-center">
                    <p className="text-sm font-black text-black">
                      {jobTitle(primaryJob)}
                    </p>
                    <p className="mt-1 text-xs font-semibold uppercase tracking-normal text-zinc-500">
                      {primaryJob.status} - {primaryJob.id.slice(0, 8)}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-sm font-semibold text-zinc-500">
                  No queued labels.
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={() => void printNextLabel()}
              className={`${primaryButtonClass} min-h-16 text-lg`}
              disabled={!primaryJob || Boolean(busy)}
            >
              <Printer size={22} aria-hidden="true" />
              {busy === "print" ? "Opening print dialog..." : "Print next label"}
            </button>

            {selectedJob ? (
              <div className="grid gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-black text-black">Current job</p>
                    <p className="mt-1 text-xs font-semibold text-zinc-500">
                      {selectedJob.status} - Attempts:{" "}
                      {selectedJob.label_print_attempts?.length || 0}
                    </p>
                  </div>
                  <span className={statusPillClass(selectedJob.status)}>
                    {selectedJob.status}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  <button
                    type="button"
                    onClick={() => void markPrinted()}
                    disabled={Boolean(busy) || selectedJob.status === "queued"}
                    className={`${primaryButtonClass} min-h-14 sm:col-span-1`}
                  >
                    <CheckCircle2 size={18} aria-hidden="true" />
                    Mark printed
                  </button>
                  <button
                    type="button"
                    onClick={() => void reprintCurrentJob()}
                    disabled={Boolean(busy)}
                    className={`${secondaryButtonClass} min-h-14`}
                  >
                    <RotateCcw size={18} aria-hidden="true" />
                    Reprint current
                  </button>
                  <button
                    type="button"
                    onClick={() => void claimNext()}
                    disabled={!queuedJobs.length || Boolean(busy)}
                    className={`${secondaryButtonClass} min-h-14`}
                  >
                    <Printer size={18} aria-hidden="true" />
                    Claim only
                  </button>
                </div>
                <label className="grid gap-1.5 text-sm font-medium text-zinc-600">
                  Failed or skip reason
                  <input
                    className={inputClass}
                    value={failureReason}
                    onChange={(event) => setFailureReason(event.target.value)}
                    placeholder="Wrong stock, bad print, customer changed drink..."
                  />
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => void releaseJob()}
                    disabled={Boolean(busy) || selectedJob.status === "queued"}
                    className={`${secondaryButtonClass} min-h-14`}
                  >
                    <RotateCcw size={18} aria-hidden="true" />
                    Mark failed / skip
                  </button>
                  <button
                    type="button"
                    onClick={() => void failJob()}
                    disabled={Boolean(busy) || selectedJob.status === "queued"}
                    className={`${dangerButtonClass} min-h-14`}
                  >
                    <XCircle size={18} aria-hidden="true" />
                    Fail permanently
                  </button>
                </div>
                {selectedJob.status === "queued" ? (
                  <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-950">
                    Claim this job before printing or marking it complete.
                  </p>
                ) : null}
              </div>
            ) : null}
          </Panel>

          <Panel className="grid content-start gap-4 p-4">
            <div>
              <h2 className="text-lg font-bold">Queue</h2>
              <p className="mt-1 text-sm text-zinc-600">
                Refreshes every few seconds while the station is open.
              </p>
            </div>

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
                <li>Choose the NIIMBOT driver in the browser print dialog.</li>
                <li>Use 50mm x 30mm label size and 100% scale.</li>
                <li>Only mark printed after the physical M2 label is correct.</li>
              </ul>
            </div>

            <JobList
              title="Claimed or printing"
              jobs={activeJobs}
              selectedJobId={selectedJob?.id || ""}
              onSelect={(id) => {
                setCurrentAttemptId("");
                setSelectedJobId(id);
              }}
            />
            <JobList
              title="Queued"
              jobs={queuedJobs}
              selectedJobId={selectedJob?.id || ""}
              onSelect={(id) => {
                setCurrentAttemptId("");
                setSelectedJobId(id);
              }}
              emphasizeFirst
            />
          </Panel>
        </div>
      </div>

      <section className="print-only hidden">
        <div className="m2-label-sheet">
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
  emphasizeFirst = false,
}: {
  title: string;
  jobs: StationJob[];
  selectedJobId: string;
  onSelect: (id: string) => void;
  emphasizeFirst?: boolean;
}) {
  return (
    <div className="grid gap-2">
      <h3 className="text-sm font-black uppercase tracking-normal text-zinc-500">
        {title}
      </h3>
      {jobs.length ? (
        <div className="grid gap-2">
          {jobs.map((job, index) => (
            <button
              key={job.id}
              type="button"
              onClick={() => onSelect(job.id)}
              className={`grid gap-1 rounded-xl border p-3 text-left transition active:scale-[0.99] ${
                job.id === selectedJobId
                  ? "border-black bg-black text-white"
                  : emphasizeFirst && index === 0
                    ? "border-black bg-white text-black shadow-sm shadow-black/10"
                  : "border-zinc-200 bg-white text-black hover:border-zinc-400"
              }`}
            >
              <span className="flex items-start justify-between gap-3">
                <span className="min-w-0 truncate text-sm font-black">
                  {jobTitle(job)}
                </span>
                <span className={job.id === selectedJobId ? "shrink-0 rounded-full bg-white px-2 py-1 text-[11px] font-black uppercase text-black" : statusPillClass(job.status)}>
                  {emphasizeFirst && index === 0 ? "next" : job.status}
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

function statusPillClass(status: LabelPrintJobStatus) {
  const base =
    "inline-flex shrink-0 items-center rounded-full px-2 py-1 text-[11px] font-black uppercase";

  if (status === "printed") return `${base} bg-emerald-100 text-emerald-950`;
  if (status === "failed") return `${base} bg-red-100 text-red-800`;
  if (status === "printing") return `${base} bg-sky-100 text-sky-950`;
  if (status === "claimed") return `${base} bg-amber-100 text-amber-950`;
  return `${base} bg-zinc-100 text-zinc-700`;
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
      Authorization: `Bearer ${token}`,
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
  const supabase = getSupabaseBrowserClient();
  if (!supabase) throw new Error("Supabase auth is not available.");
  return getAppAccessToken(supabase);
}

function latestStartedAttempt(job: StationJob) {
  return [...(job.label_print_attempts || [])]
    .filter((attempt) => attempt.status === "started")
    .sort((a, b) => b.started_at.localeCompare(a.started_at))[0];
}

function jobTitle(job: StationJob) {
  return job.payload.label.personName || job.payload.label.title || "Cup label";
}
