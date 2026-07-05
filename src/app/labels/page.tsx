"use client";

import Link from "next/link";
import {
  CheckCircle2,
  Clipboard,
  Download,
  FileSpreadsheet,
  ImageDown,
  Link2,
  Loader2,
  Printer,
  RotateCcw,
  Share2,
  Smile,
  UserRound,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
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
  initialLabelExportSelection,
  labelExportItemsForProduction,
  labelExportProductions,
  niimbotBatchCsv,
  unprintedOrderIds,
} from "@/lib/label-export";
import {
  describeDataError,
  isSupabaseBacked,
  loadCoffeeData,
  resetDemoCoffeeData,
  updateOrderRecord,
} from "@/lib/data";
import { mintProductionShareLink } from "@/lib/share-links";
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
  const [requestedOrderId] = useState(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("order") || "";
  });
  const [requestedProductionId] = useState(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("production") || "";
  });
  const [data, setData] = useState<CoffeeData | null>(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [productionId, setProductionId] = useState("");
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [printerLink, setPrinterLink] = useState("");
  const [printerLinkState, setPrinterLinkState] = useState<
    "idle" | "working" | "copied"
  >("idle");
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
        const initialSelection = initialLabelExportSelection(
          next,
          requestedOrderId,
          requestedProductionId,
        );
        const nextProductionId = initialSelection.productionId;
        setProductionId((current) => current || nextProductionId);
        setSelectedOrderIds((current) =>
          current.length ? current : initialSelection.selectedOrderIds,
        );
      })
      .catch((err: unknown) => {
        setError(describeDataError(err, "Could not load labels."));
      });
  }, [requestedOrderId, requestedProductionId]);

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
  const selectedProduction = selection?.production;
  const testLabel = useMemo(
    () => (selection ? buildClientTestLabel(selection.client?.name || selection.production.name) : null),
    [selection],
  );
  const previewLabel = labels[0];
  const selectedCount = labels.length;

  function chooseProduction(nextProductionId: string) {
    setProductionId(nextProductionId);
    // Batch by default: switching production selects its whole label run.
    const nextItems = data
      ? labelExportItemsForProduction(data, nextProductionId)
      : [];
    setSelectedOrderIds(nextItems.map((item) => item.order.id));
    setStatus("");
  }

  async function copyPrinterLink() {
    if (!productionId) {
      setError("Choose a production before linking CTC Printer.");
      return;
    }
    if (!isSupabaseBacked) {
      setError("CTC Printer links need the Supabase-backed app, not local demo mode.");
      return;
    }

    setPrinterLinkState("working");
    setError("");
    setStatus("");

    try {
      const url = await mintProductionShareLink(productionId, {
        label: "ctc-printer",
      });
      setPrinterLink(url);
      try {
        await writeClipboardText(url);
        setPrinterLinkState("copied");
        setStatus("CTC Printer link copied. Paste it into CTC Printer and tap Link production.");
      } catch {
        setPrinterLinkState("idle");
        setStatus("CTC Printer link created. Select the link below and paste it into CTC Printer.");
      }
    } catch (err) {
      setPrinterLinkState("idle");
      setError(describeDataError(err, "Could not create the CTC Printer link."));
    }
  }

  async function copyExistingPrinterLink(url: string) {
    try {
      await writeClipboardText(url);
      setPrinterLinkState("copied");
      setStatus("CTC Printer link copied.");
      setError("");
    } catch (err) {
      setError(describeDataError(err, "Could not copy the CTC Printer link."));
    }
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
  const unprintedIds = useMemo(() => unprintedOrderIds(activeItems), [activeItems]);

  function toggleSelectAll() {
    setSelectedOrderIds(
      allSelected
        ? []
        : activeItems.flatMap((item) => (item.order ? [item.order.id] : [])),
    );
    setStatus("");
  }

  function selectUnprinted() {
    setSelectedOrderIds(unprintedIds);
    setStatus("");
  }

  /**
   * Best-effort bookkeeping after a successful export so "Unprinted" stays
   * meaningful for reprints. Failures never turn a completed export into an
   * error.
   */
  async function markLabelsPrinted(orderIds: string[]) {
    if (!data) return;
    try {
      let next = data;
      for (const orderId of orderIds) {
        const order = next.orders.find((item) => item.id === orderId);
        if (!order || order.label_printed) continue;
        next = await updateOrderRecord(next, orderId, { label_printed: true });
      }
      setData(next);
    } catch {
      // Leave the printed flags as-is; the export itself already succeeded.
    }
  }

  async function resetDemo() {
    const next = await resetDemoCoffeeData();
    setData(next);
    const initialSelection = initialLabelExportSelection(next, requestedOrderId);
    setProductionId(initialSelection.productionId);
    setSelectedOrderIds(initialSelection.selectedOrderIds);
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
      await markLabelsPrinted(labels.map((label) => label.id));
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
      await markLabelsPrinted(labels.map((label) => label.id));
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
              Step 3
            </p>
            <h1 className="mt-0.5 text-2xl font-black leading-tight tracking-normal text-black">
              Send labels to CTC Printer
            </h1>
            <p className="mt-1 max-w-2xl text-sm font-medium leading-6 text-zinc-600">
              Take the orders here, copy the production link, paste it into CTC
              Printer, and print from the phone connected to the NIIMBOT.
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

      <Panel className="mt-4 grid gap-4 border-2 p-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-xl font-black">
              <Printer size={22} aria-hidden="true" />
              CTC Printer
            </h2>
            <p className="mt-1 max-w-2xl text-sm font-semibold leading-6 text-zinc-600">
              {selectedProduction
                ? `${selectedProduction.name}: ${activeItems.length} printable labels, ${unprintedIds.length} not yet printed.`
                : "Choose a production to link the printer app."}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void copyPrinterLink()}
            disabled={printerLinkState === "working" || !productionId || !isSupabaseBacked}
            className={`${primaryButtonClass} min-h-14 text-base`}
          >
            {printerLinkState === "working" ? (
              <Loader2 size={20} className="animate-spin" aria-hidden="true" />
            ) : printerLinkState === "copied" ? (
              <CheckCircle2 size={20} aria-hidden="true" />
            ) : (
              <Clipboard size={20} aria-hidden="true" />
            )}
            {printerLinkState === "working"
              ? "Creating link..."
              : printerLinkState === "copied"
                ? "Printer link copied"
                : "Copy CTC Printer link"}
          </button>
        </div>

        <Field label="Production to print">
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

        {printerLink ? (
          <div className="grid gap-2">
            <label
              htmlFor="ctc-printer-link"
              className="text-xs font-black uppercase tracking-normal text-zinc-600"
            >
              Paste this into CTC Printer
            </label>
            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
              <input
                id="ctc-printer-link"
                readOnly
                value={printerLink}
                className={`${inputClass} font-mono text-sm`}
                onFocus={(event) => event.currentTarget.select()}
              />
              <button
                type="button"
                onClick={() => void copyExistingPrinterLink(printerLink)}
                className={`${secondaryButtonClass} min-h-11`}
              >
                <Clipboard size={18} aria-hidden="true" />
                Copy again
              </button>
            </div>
          </div>
        ) : null}

        {!isSupabaseBacked ? (
          <p className="rounded-lg border border-amber-700 bg-amber-50 p-3 text-sm font-bold text-amber-900">
            CTC Printer links are only available when the app is connected to
            Supabase. Local demo mode can still export fallback PNGs and CSVs.
          </p>
        ) : null}

        <div className="grid gap-2 sm:grid-cols-3">
          <PrinterStep
            icon={<Clipboard size={18} aria-hidden="true" />}
            title="Copy link"
            detail="Creates a token for this production."
          />
          <PrinterStep
            icon={<Link2 size={18} aria-hidden="true" />}
            title="Paste in CTC Printer"
            detail="Tap Link production in the iPhone app."
          />
          <PrinterStep
            icon={<Printer size={18} aria-hidden="true" />}
            title="Print queue"
            detail="The app pulls labels and marks them printed."
          />
        </div>
      </Panel>

      <div className="mt-4 grid min-w-0 gap-4 lg:grid-cols-[minmax(300px,0.85fr)_minmax(360px,1.15fr)]">
        <Panel className="grid content-start gap-4 p-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <UserRound size={19} aria-hidden="true" />
              Fallback selection
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
          <p className="text-sm font-semibold leading-6 text-zinc-600">
            These checkboxes only control PNG and CSV fallback exports. CTC
            Printer pulls the production queue from the link above.
          </p>

          {activeItems.length ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-bold text-zinc-600">
                  {selectedCount} of {activeItems.length} labels selected
                </p>
                <div className="flex gap-1.5">
                  {unprintedIds.length && unprintedIds.length < activeItems.length ? (
                    <button
                      type="button"
                      onClick={selectUnprinted}
                      className={`${secondaryButtonClass} min-h-10 px-3`}
                    >
                      Unprinted ({unprintedIds.length})
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={toggleSelectAll}
                    className={`${secondaryButtonClass} min-h-10 px-3`}
                  >
                    <CheckCircle2 size={16} aria-hidden="true" />
                    {allSelected ? "None" : "All"}
                  </button>
                </div>
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
                Preview and fallback exports
              </h2>
              <Link href="/productions" className={`${secondaryButtonClass} min-h-10 px-3`}>
                Days
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
                  Fallback CSV
                </div>
                <p className="text-xs leading-5 text-zinc-600">
                  For NIIMBOT batch templates when CTC Printer is unavailable.
                </p>
                <button
                  type="button"
                  onClick={downloadNiimbotCsv}
                  disabled={busy || !selection?.items.length}
                  className={`${secondaryButtonClass} mt-1 min-h-14 text-base`}
                >
                  <FileSpreadsheet size={20} aria-hidden="true" />
                  Export CSV
                </button>
              </div>

              <div className="border-accent/50 bg-accent/5 grid content-start gap-2 rounded-xl border-2 p-3">
                <div className="text-accent-ink flex items-center gap-1.5 text-xs font-black uppercase tracking-normal">
                  <ImageDown size={14} aria-hidden="true" />
                  Fallback PNG
                </div>
                <p className="text-xs leading-5 text-zinc-600">
                  Individual label asset for manual NIIMBOT app import.
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
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-2 min-[420px]:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
          <button
            type="button"
            onClick={() => void copyPrinterLink()}
            disabled={printerLinkState === "working" || !productionId || !isSupabaseBacked}
            className={`${primaryButtonClass} px-2 text-xs min-[360px]:text-sm`}
          >
            {printerLinkState === "working" ? (
              <Loader2 size={18} className="animate-spin" aria-hidden="true" />
            ) : printerLinkState === "copied" ? (
              <CheckCircle2 size={18} aria-hidden="true" />
            ) : (
              <Clipboard size={18} aria-hidden="true" />
            )}
            {printerLinkState === "copied" ? "Link copied" : "Copy printer link"}
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

function PrinterStep({
  icon,
  title,
  detail,
}: {
  icon: ReactNode;
  title: string;
  detail: string;
}) {
  return (
    <div className="grid min-h-24 grid-cols-[auto_minmax(0,1fr)] gap-3 rounded-lg border border-zinc-300 bg-zinc-50 p-3">
      <span className="grid size-9 place-items-center rounded-lg border border-black bg-white text-black">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-black text-black">{title}</span>
        <span className="mt-1 block text-sm font-semibold leading-5 text-zinc-600">
          {detail}
        </span>
      </span>
    </div>
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
        <span className="mt-2 flex max-w-full flex-wrap gap-1.5">
          <span
            className={`inline-flex max-w-full rounded-md border px-2 py-1 text-xs font-bold ${
              selected
                ? "border-white/30 bg-white/10 text-white"
                : "border-zinc-300 bg-zinc-100 text-zinc-700"
            }`}
          >
            <span className="truncate">{group}</span>
          </span>
          {item.order.label_printed ? (
            <span
              className={`inline-flex rounded-md border px-2 py-1 text-xs font-bold ${
                selected
                  ? "border-white/30 bg-white/10 text-white"
                  : "border-emerald-700 bg-emerald-50 text-emerald-800"
              }`}
            >
              Printed
            </span>
          ) : null}
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

async function writeClipboardText(value: string) {
  if (!navigator.clipboard?.writeText) {
    throw new Error("Clipboard access is unavailable. Select and copy the link manually.");
  }
  await navigator.clipboard.writeText(value);
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
