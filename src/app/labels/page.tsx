"use client";

import Link from "next/link";
import {
  CheckCircle2,
  Download,
  FileSpreadsheet,
  ImageDown,
  RotateCcw,
  Share2,
  Smile,
  UserRound,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { ScreenLabel } from "@/components/coffee-label-renderer";
import {
  Avatar,
  EmptyState,
  Field,
  Panel,
  inputClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/ui";
import {
  buildLabelExportSelection,
  type ActiveLabelExportItem,
  defaultLabelExportOptions,
  labelExportItemsForProduction,
  labelExportProductions,
  niimbotBatchCsv,
  preferredLabelExportProduction,
} from "@/lib/label-export";
import {
  describeDataError,
  isSupabaseBacked,
  loadCoffeeData,
  resetDemoCoffeeData,
} from "@/lib/data";
import { formatDrink } from "@/lib/order-summary";
import {
  niimbotM2ExportFileName,
  niimbotM2ExportPreset,
  renderNiimbotM2LabelPngBlob,
} from "@/lib/niimbot-m2-export";
import type { CoffeeData } from "@/lib/types";
import type { CoffeeLabel } from "@/lib/label-copy";

type ShareNavigator = Navigator & {
  canShare?: (data: { files?: File[] }) => boolean;
  share?: (data: { files?: File[]; title?: string; text?: string }) => Promise<void>;
};

export default function LabelExportPage() {
  const [data, setData] = useState<CoffeeData | null>(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [productionId, setProductionId] = useState("");
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [shareReady] = useState(
    () =>
      typeof navigator !== "undefined" &&
      typeof (navigator as ShareNavigator).share === "function",
  );

  const loadData = useCallback(() => {
    loadCoffeeData()
      .then((next) => {
        setError("");
        setStatus("");
        setData(next);
        const preferred = preferredLabelExportProduction(next);
        const nextProductionId = preferred?.id || "";
        setProductionId((current) => current || nextProductionId);
        if (nextProductionId) {
          setSelectedOrderIds((current) =>
            current.length
              ? current
              : labelExportItemsForProduction(next, nextProductionId)
                  .slice(0, 1)
                  .flatMap((item) => (item.order ? [item.order.id] : [])),
          );
        }
      })
      .catch((err: unknown) => {
        setError(describeDataError(err, "Could not load labels."));
      });
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const productions = useMemo(
    () => (data ? labelExportProductions(data) : []),
    [data],
  );
  const activeItems = useMemo(
    () => (data && productionId ? labelExportItemsForProduction(data, productionId) : []),
    [data, productionId],
  );
  const selection = useMemo(
    () =>
      data && productionId
        ? buildLabelExportSelection(
            data,
            productionId,
            selectedOrderIds,
            defaultLabelExportOptions,
          )
        : null,
    [data, productionId, selectedOrderIds],
  );
  const labels = selection?.labels || [];
  const testLabel = useMemo(
    () => (selection ? buildClientTestLabel(selection.client?.name || selection.production.name) : null),
    [selection],
  );
  const previewLabel = labels[0];
  const selectedCount = labels.length;

  function chooseProduction(nextProductionId: string) {
    setProductionId(nextProductionId);
    const nextItems = data
      ? labelExportItemsForProduction(data, nextProductionId)
      : [];
    setSelectedOrderIds(
      nextItems.slice(0, 1).flatMap((item) => (item.order ? [item.order.id] : [])),
    );
    setStatus("");
  }

  function toggleOrder(orderId: string) {
    setSelectedOrderIds((current) =>
      current.includes(orderId)
        ? current.filter((id) => id !== orderId)
        : [...current, orderId],
    );
    setStatus("");
  }

  const allSelected = activeItems.length > 0 && selectedCount >= activeItems.length;

  function toggleSelectAll() {
    setSelectedOrderIds(
      allSelected
        ? []
        : activeItems.flatMap((item) => (item.order ? [item.order.id] : [])),
    );
    setStatus("");
  }

  async function resetDemo() {
    const next = await resetDemoCoffeeData();
    setData(next);
    const preferred = preferredLabelExportProduction(next);
    const nextProductionId = preferred?.id || "";
    setProductionId(nextProductionId);
    setSelectedOrderIds(
      nextProductionId
        ? labelExportItemsForProduction(next, nextProductionId)
            .slice(0, 1)
            .flatMap((item) => (item.order ? [item.order.id] : []))
        : [],
    );
    setStatus("Demo data reset on this device.");
  }

  async function downloadSelected() {
    if (!labels.length) {
      setError("Select at least one active label.");
      return;
    }

    setBusy(true);
    setError("");
    setStatus("");

    try {
      for (const label of labels) {
        const blob = await renderNiimbotM2LabelPngBlob(label);
        downloadBlob(blob, niimbotM2ExportFileName(label));
      }
      setStatus(
        `${labels.length} label PNG ${
          labels.length === 1 ? "file" : "files"
        } ready for NIIMBOT app import.`,
      );
    } catch (err) {
      setError(describeDataError(err, "Could not export the selected label."));
    } finally {
      setBusy(false);
    }
  }

  async function downloadTestLabel() {
    if (!testLabel) {
      setError("Choose a production before exporting a test label.");
      return;
    }

    setBusy(true);
    setError("");
    setStatus("");

    try {
      const blob = await renderNiimbotM2LabelPngBlob(testLabel);
      downloadBlob(blob, niimbotM2ExportFileName(testLabel));
      setStatus(`${testLabel.title} test label PNG ready for NIIMBOT app import.`);
    } catch (err) {
      setError(describeDataError(err, "Could not export the test label."));
    } finally {
      setBusy(false);
    }
  }

  async function shareSelected() {
    if (!labels.length) {
      setError("Select at least one active label.");
      return;
    }

    const shareNavigator = navigator as ShareNavigator;
    if (typeof shareNavigator.share !== "function") {
      setStatus("Sharing is not available here. Use Download PNG instead.");
      return;
    }

    setBusy(true);
    setError("");
    setStatus("");

    try {
      const files = await Promise.all(
        labels.map(async (label) => {
          const blob = await renderNiimbotM2LabelPngBlob(label);
          return new File([blob], niimbotM2ExportFileName(label), {
            type: "image/png",
          });
        }),
      );

      if (
        typeof shareNavigator.canShare === "function" &&
        !shareNavigator.canShare({ files })
      ) {
        setStatus("This browser cannot share PNG files. Use Download PNG instead.");
        return;
      }

      await shareNavigator.share({
        files,
        title: "Capture This Coffee labels",
        text: "Print-ready Capture This Coffee label PNGs.",
      });
      setStatus("Shared PNG label file.");
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError(describeDataError(err, "Could not share the selected label."));
    } finally {
      setBusy(false);
    }
  }

  function downloadNiimbotCsv() {
    if (!selection || !selection.items.length) {
      setError("Select at least one active order for CSV export.");
      return;
    }

    const csv = niimbotBatchCsv(selection.items);
    const fileName = `${safeFilePart(selection.production.name)}-niimbot-batch.csv`;
    downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }), fileName);
    setError("");
    setStatus(
      `${selection.items.length} ${selection.items.length === 1 ? "row" : "rows"} exported for NIIMBOT batch templates.`,
    );
  }

  return (
    <AppShell title="Labels" requireAuth>
      <section className="rule-double grid gap-4 pb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-normal text-zinc-500">
              Label workstation
            </p>
            <h1 className="mt-0.5 text-2xl font-black leading-tight tracking-normal text-black">
              Export &amp; print
            </h1>
            <p className="mt-1 max-w-2xl text-sm font-medium leading-6 text-zinc-600">
              Export a crew CSV for NIIMBOT batch templates, or save a print-ready
              PNG for hero cups.
            </p>
          </div>
          <div className="rounded-lg border-2 border-black bg-white px-3 py-2 font-mono text-sm font-black text-black">
            {niimbotM2ExportPreset.widthMm}×{niimbotM2ExportPreset.heightMm}mm
            <span className="mx-1.5 text-zinc-400">/</span>
            {niimbotM2ExportPreset.dpi} DPI
          </div>
        </div>
      </section>

      {error ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-700 bg-white p-3 text-sm font-bold text-red-700">
          <span>{error}</span>
          {!data ? (
            <button
              type="button"
              onClick={loadData}
              className={`${secondaryButtonClass} min-h-10 px-3`}
            >
              <RotateCcw size={16} aria-hidden="true" />
              Try again
            </button>
          ) : null}
        </div>
      ) : null}

      {status ? (
        <p className="mt-4 rounded-lg border border-zinc-500 bg-white p-3 text-sm font-bold text-black">
          {status}
        </p>
      ) : null}

      <div className="mt-4 grid min-w-0 gap-4 lg:grid-cols-[minmax(300px,0.85fr)_minmax(360px,1.15fr)]">
        <Panel className="grid content-start gap-4 p-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <UserRound size={19} aria-hidden="true" />
              Select labels
            </h2>
            {!isSupabaseBacked ? (
              <button
                type="button"
                onClick={() => void resetDemo()}
                className={`${secondaryButtonClass} min-w-11 px-3`}
                aria-label="Reset demo data"
              >
                <RotateCcw size={18} aria-hidden="true" />
              </button>
            ) : null}
          </div>

          <Field label="Production">
            <select
              className={inputClass}
              value={productionId}
              onChange={(event) => chooseProduction(event.target.value)}
              disabled={!productions.length}
            >
              {productions.map((production) => (
                <option key={production.id} value={production.id}>
                  {production.name}
                </option>
              ))}
            </select>
          </Field>

          {activeItems.length ? (
            <>
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-bold text-zinc-600">
                  {selectedCount} selected / {activeItems.length} active
                </p>
                <button
                  type="button"
                  onClick={toggleSelectAll}
                  className={`${secondaryButtonClass} min-h-10 px-3`}
                >
                  <CheckCircle2 size={16} aria-hidden="true" />
                  {allSelected ? "None" : "All"}
                </button>
              </div>
              <div className="grid max-h-[58vh] gap-2 overflow-y-auto pr-1">
                {activeItems.map((item) =>
                  item.order ? (
                    <LabelChoice
                      key={item.order.id}
                      item={item}
                      selected={selectedOrderIds.includes(item.order.id)}
                      onToggle={() => toggleOrder(item.order.id)}
                    />
                  ) : null,
                )}
              </div>
            </>
          ) : (
            <EmptyState
              title="No active labels"
              description="This production has no on-set orders ready for label export."
            />
          )}
        </Panel>

        <div className="grid content-start gap-4">
          <Panel className="grid gap-4 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-lg font-bold">
                <ImageDown size={19} aria-hidden="true" />
                Preview
              </h2>
              <Link href="/productions" className={`${secondaryButtonClass} min-h-10 px-3`}>
                Jobs
              </Link>
            </div>

            <div
              className="grid min-h-[210px] min-w-0 place-items-center overflow-hidden rounded-xl border-2 border-black p-3 sm:min-h-[340px] sm:p-6"
              style={{
                background:
                  "repeating-linear-gradient(0deg, rgb(255 255 255 / 0.045) 0 1px, transparent 1px 24px), repeating-linear-gradient(90deg, rgb(255 255 255 / 0.045) 0 1px, transparent 1px 24px), #18181b",
              }}
            >
              {previewLabel ? (
                <div className="grid w-full min-w-0 place-items-center drop-shadow-[0_10px_28px_rgba(0,0,0,0.5)]">
                  <ScreenLabel label={previewLabel} />
                </div>
              ) : (
                <p className="text-center text-sm font-bold text-zinc-300">
                  Select a label to preview the PNG.
                </p>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid content-start gap-2 rounded-xl border border-zinc-300 bg-zinc-50 p-3">
                <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-normal text-zinc-500">
                  <FileSpreadsheet size={14} aria-hidden="true" />
                  CSV batch
                </div>
                <p className="text-xs leading-5 text-zinc-600">
                  Full crew run, one row per person, for NIIMBOT batch templates.
                </p>
                <button
                  type="button"
                  onClick={downloadNiimbotCsv}
                  disabled={busy || !selection?.items.length}
                  className={`${primaryButtonClass} mt-1 min-h-14 text-base`}
                >
                  <FileSpreadsheet size={20} aria-hidden="true" />
                  Export CSV — crew batch
                </button>
              </div>

              <div className="border-accent/50 bg-accent/5 grid content-start gap-2 rounded-xl border-2 p-3">
                <div className="text-accent-ink flex items-center gap-1.5 text-xs font-black uppercase tracking-normal">
                  <ImageDown size={14} aria-hidden="true" />
                  PNG hero
                </div>
                <p className="text-xs leading-5 text-zinc-600">
                  Branded, print-ready cup label from the CTC renderer.
                </p>
                <div className="mt-1 grid grid-cols-1 gap-2 min-[360px]:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => void downloadSelected()}
                    disabled={busy || !labels.length}
                    className={`${secondaryButtonClass} min-h-14 text-sm`}
                  >
                    <Download size={19} aria-hidden="true" />
                    {busy ? "Exporting…" : "Export PNG"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void shareSelected()}
                    disabled={busy || !labels.length || !shareReady}
                    className={`${secondaryButtonClass} min-h-14 text-sm`}
                  >
                    <Share2 size={19} aria-hidden="true" />
                    Share
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => void downloadTestLabel()}
                  disabled={busy || !testLabel}
                  className={`${secondaryButtonClass} min-h-11 text-sm`}
                >
                  <Smile size={18} aria-hidden="true" />
                  Test label
                </button>
              </div>
            </div>
          </Panel>
        </div>
      </div>

      <div className="h-20 lg:hidden" aria-hidden="true" />

      <div className="no-print fixed inset-x-0 bottom-0 z-40 border-t border-black bg-white p-3 lg:hidden">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-2">
          <button
            type="button"
            onClick={downloadNiimbotCsv}
            disabled={busy || !selection?.items.length}
            className={`${primaryButtonClass} px-2 text-xs min-[360px]:text-sm`}
          >
            <FileSpreadsheet size={18} aria-hidden="true" />
            Export CSV{selectedCount ? ` · ${selectedCount}` : ""}
          </button>
          <button
            type="button"
            onClick={() => void downloadSelected()}
            disabled={busy || !labels.length}
            className={`${secondaryButtonClass} px-2 text-xs min-[360px]:text-sm`}
          >
            <Download size={18} aria-hidden="true" />
            {busy ? "Exporting…" : `Export PNG${selectedCount ? ` · ${selectedCount}` : ""}`}
          </button>
        </div>
      </div>
    </AppShell>
  );
}

function LabelChoice({
  item,
  selected,
  onToggle,
}: {
  item: ActiveLabelExportItem;
  selected: boolean;
  onToggle: () => void;
}) {
  const group = item.roster.group_label || item.person.department || "Set";

  return (
    <button
      type="button"
      onClick={onToggle}
      className={`grid min-h-24 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border p-3 text-left transition active:translate-y-px ${
        selected
          ? "border-black bg-black text-white"
          : "border-zinc-300 bg-white text-black hover:border-black"
      }`}
      aria-pressed={selected}
    >
      <Avatar person={item.person} />
      <span className="min-w-0">
        <span className="block truncate text-base font-black leading-tight">
          {item.person.name}
        </span>
        <span
          className={`mt-1 block truncate text-sm font-semibold ${
            selected ? "text-zinc-200" : "text-zinc-600"
          }`}
        >
          {formatDrink(item.order)}
        </span>
        <span
          className={`mt-2 inline-flex max-w-full rounded-md border px-2 py-1 text-xs font-bold ${
            selected
              ? "border-white/30 bg-white/10 text-white"
              : "border-zinc-300 bg-zinc-100 text-zinc-700"
          }`}
        >
          <span className="truncate">{group}</span>
        </span>
      </span>
      <span
        className={`grid size-7 place-items-center rounded-md border ${
          selected ? "border-white bg-white text-black" : "border-zinc-400 bg-white"
        }`}
        aria-hidden="true"
      >
        {selected ? <CheckCircle2 size={18} /> : null}
      </span>
    </button>
  );
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function buildClientTestLabel(clientName: string): CoffeeLabel {
  const title = clientName.trim() || "Capture This Coffee";
  const bodyLines = ["Have a nice day"];

  return {
    id: `test-${safeFilePart(title)}`,
    personName: title,
    drink: bodyLines[0],
    group: "",
    productionClient: title,
    notesStatus: "",
    orderId: "TEST",
    title,
    bodyLines,
    footerStart: "",
    footerEnd: "",
    lines: [title, ...bodyLines],
  };
}

function safeFilePart(value: string) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "production"
  );
}
