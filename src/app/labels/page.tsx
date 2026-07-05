"use client";

import Link from "next/link";
import {
  CheckCircle2,
  Clipboard,
  Download,
  FileSpreadsheet,
  Loader2,
  Printer,
  RotateCcw,
  Share2,
  Smile,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { ScreenLabel } from "@/components/coffee-label-renderer";
import { useAppAuth } from "@/components/app-auth-provider";
import {
  Avatar,
  EmptyState,
  Field,
  inputClass,
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
  updateOrderRecord,
} from "@/lib/data";
import { mintProductionShareLink } from "@/lib/share-links";
import { formatDrink } from "@/lib/order-summary";
import {
  niimbotM2ExportFileName,
  renderNiimbotM2LabelPngBlob,
} from "@/lib/niimbot-m2-export";
import type { CoffeeData } from "@/lib/types";
import type { CoffeeLabel } from "@/lib/label-copy";

type ShareNavigator = Navigator & {
  canShare?: (data: { files?: File[] }) => boolean;
  share?: (data: { files?: File[]; title?: string; text?: string }) => Promise<void>;
};

// Custom premium buttons matching our Capture This Coffee neo-brutalist / studio aesthetic
const customPrimaryBtn =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border-[3px] border-black bg-black text-white font-black text-sm uppercase tracking-wider hover:bg-zinc-800 transition active:translate-y-px disabled:opacity-50";

const customSecondaryBtn =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border-[3px] border-black bg-white text-black font-black text-sm uppercase tracking-wider hover:bg-zinc-100 transition active:translate-y-px disabled:opacity-50";

export default function LabelExportPage() {
  const { isAdmin } = useAppAuth();
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
        setStatus("CTC Printer link copied to clipboard.");
      } catch {
        setPrinterLinkState("idle");
        setStatus("Printer link created. Select and copy it below.");
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
      // Ignore printing flag updates on export
    }
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
        } ready for import.`,
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
      setStatus(`${testLabel.title} test label PNG downloaded.`);
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
      setStatus("Sharing is not available here. Use Download instead.");
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
        setStatus("This device cannot share these files. Use Download instead.");
        return;
      }

      await shareNavigator.share({
        files,
        title: "Capture This Coffee labels",
        text: "Print-ready label PNGs.",
      });
      setStatus("Shared label files.");
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
      `${selection.items.length} ${selection.items.length === 1 ? "row" : "rows"} exported.`,
    );
  }

  return (
    <AppShell title="Labels" requireAuth>
      {/* Center Layout Container for a Clean Studio Vibe */}
      <div className="mx-auto w-full max-w-md px-1 sm:max-w-xl sm:px-0 md:max-w-3xl">
        <section className="mb-6 rounded-xl border-[3px] border-black bg-white p-5 shadow-[4px_4px_0_#000]">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-black uppercase tracking-tight text-black">Labels</h1>
              <p className="mt-1 text-sm font-medium leading-relaxed text-zinc-600">
                Manage print queues, select drink labels, and connect to CTC Printer.
              </p>
            </div>
            <Link href="/productions" className={`${customSecondaryBtn} hidden sm:inline-flex min-h-11 py-0 px-4 text-xs`}>
              Days
            </Link>
          </div>
        </section>

        {error ? (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-700 bg-white p-3 text-sm font-bold text-red-700">
            <span>{error}</span>
            {!data && (
              <button
                type="button"
                onClick={loadData}
                className={`${customSecondaryBtn} min-h-10 px-3 py-0 text-xs`}
              >
                <RotateCcw size={14} aria-hidden="true" />
                Retry
              </button>
            )}
          </div>
        ) : null}

        {status ? (
          <p className="mb-4 rounded-lg border border-zinc-500 bg-white p-3 text-sm font-bold text-black">
            {status}
          </p>
        ) : null}

        {/* Printer Connection Card */}
        <section className="mb-6 rounded-xl border-[3px] border-black bg-white p-5 shadow-[4px_4px_0_#000]">
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <Printer size={22} className="text-black" />
              <h2 className="text-lg font-black uppercase tracking-tight text-black">CTC Printer Connection</h2>
            </div>
            <p className="text-sm font-semibold text-zinc-600">
              {selectedProduction
                ? `${selectedProduction.name}: ${activeItems.length} labels, ${unprintedIds.length} remaining.`
                : "Choose a production day to load the printer queue."}
            </p>

            <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
              <Field label="Selected Day">
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

              <div className="flex items-end">
                <button
                  type="button"
                  onClick={() => void copyPrinterLink()}
                  disabled={printerLinkState === "working" || !productionId || !isSupabaseBacked}
                  className={`${customPrimaryBtn} w-full min-h-11 h-11 py-0 px-3 text-xs`}
                >
                  {printerLinkState === "working" ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : printerLinkState === "copied" ? (
                    <CheckCircle2 size={16} />
                  ) : (
                    <Clipboard size={16} />
                  )}
                  {printerLinkState === "working"
                    ? "Linking..."
                    : printerLinkState === "copied"
                      ? "Link Copied"
                      : "Copy Link"}
                </button>
              </div>
            </div>

            {printerLink && (
              <div className="grid gap-1.5 border-t border-zinc-200 pt-3">
                <label
                  htmlFor="ctc-printer-link"
                  className="text-xs font-black uppercase tracking-normal text-zinc-500"
                >
                  Link URL (Paste into CTC Printer iPhone App)
                </label>
                <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                  <input
                    id="ctc-printer-link"
                    readOnly
                    value={printerLink}
                    className={`${inputClass} font-mono text-sm bg-zinc-50`}
                    onFocus={(event) => event.currentTarget.select()}
                  />
                  <button
                    type="button"
                    onClick={() => void copyExistingPrinterLink(printerLink)}
                    className={`${customSecondaryBtn} min-h-11 h-11 py-0 px-3 text-xs`}
                  >
                    <Clipboard size={16} />
                    Copy Again
                  </button>
                </div>
              </div>
            )}

            {!isSupabaseBacked && (
              <p className="rounded-lg border-[3px] border-zinc-400 bg-zinc-100 p-3 text-xs font-bold text-zinc-800 leading-normal">
                Printer linking requires a Supabase database backend. In local demo mode, use the Download fallback exports below.
              </p>
            )}
          </div>
        </section>

        {/* Labels Selection & Preview Section */}
        <div className="grid gap-6 md:grid-cols-[1.2fr_1fr] items-start">
          {/* Print Queue / Checkboxes Card */}
          <section className="rounded-xl border-[3px] border-black bg-white p-5 shadow-[4px_4px_0_#000] flex flex-col gap-4">
            <div className="flex items-center justify-between gap-3 min-w-0">
              <h2 className="text-lg font-black uppercase tracking-tight text-black flex-1 truncate">Print Queue</h2>
              <div className="flex gap-1.5 shrink-0">
                {unprintedIds.length > 0 && unprintedIds.length < activeItems.length && (
                  <button
                    type="button"
                    onClick={selectUnprinted}
                    className="inline-flex min-h-9 items-center justify-center rounded-lg border-[3px] border-black bg-white px-2.5 text-xs font-black uppercase text-black hover:bg-zinc-100 transition active:translate-y-px"
                  >
                    Unprinted ({unprintedIds.length})
                  </button>
                )}
                <button
                  type="button"
                  onClick={toggleSelectAll}
                  className="inline-flex min-h-9 items-center justify-center rounded-lg border-[3px] border-black bg-white px-2.5 text-xs font-black uppercase text-black hover:bg-zinc-100 transition active:translate-y-px"
                >
                  {allSelected ? "Clear" : "All"}
                </button>
              </div>
            </div>

            {activeItems.length ? (
              <div className="grid max-h-[50dvh] gap-3 overflow-y-auto pr-1">
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
            ) : (
              <EmptyState
                title="No active labels"
                description="This day roster has no confirmed coffee orders ready."
              />
            )}
          </section>

          {/* Fallback Exports / Preview Column */}
          <div className="flex flex-col gap-6">
            <section className="rounded-xl border-[3px] border-black bg-white p-5 shadow-[4px_4px_0_#000] flex flex-col gap-4">
              <h2 className="text-lg font-black uppercase tracking-tight text-black">Preview</h2>

              <div
                className="grid aspect-[5/3] w-full min-w-0 place-items-center overflow-hidden rounded-xl border-[3px] border-black p-4"
                style={{
                  background:
                    "repeating-linear-gradient(0deg, rgb(255 255 255 / 0.045) 0 1px, transparent 1px 24px), repeating-linear-gradient(90deg, rgb(255 255 255 / 0.045) 0 1px, transparent 1px 24px), #18181b",
                }}
              >
                {previewLabel ? (
                  <div className="w-full min-w-0 drop-shadow-[0_10px_20px_rgba(0,0,0,0.4)] flex justify-center">
                    <ScreenLabel label={previewLabel} />
                  </div>
                ) : (
                  <p className="text-center text-xs font-black text-zinc-400 uppercase tracking-wider">
                    Select a drink to preview
                  </p>
                )}
              </div>

              <div className="grid gap-2">
                <button
                  type="button"
                  onClick={() => void downloadSelected()}
                  disabled={busy || !labels.length}
                  className={customPrimaryBtn + " w-full"}
                >
                  <Download size={18} />
                  {busy ? "Exporting..." : `Download PNGs (${selectedCount})`}
                </button>

                {shareReady && (
                  <button
                    type="button"
                    onClick={() => void shareSelected()}
                    disabled={busy || !labels.length}
                    className={customSecondaryBtn + " w-full"}
                  >
                    <Share2 size={18} />
                    Share
                  </button>
                )}

                <div className="grid grid-cols-2 gap-2 mt-1">
                  <button
                    type="button"
                    onClick={downloadNiimbotCsv}
                    disabled={busy || !selection?.items.length}
                    className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg border-[2px] border-zinc-400 bg-white text-zinc-600 font-bold text-xs uppercase tracking-wider hover:border-black hover:text-black transition"
                  >
                    <FileSpreadsheet size={14} />
                    CSV Export
                  </button>
                  <button
                    type="button"
                    onClick={() => void downloadTestLabel()}
                    disabled={busy || !testLabel}
                    className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg border-[2px] border-zinc-400 bg-white text-zinc-600 font-bold text-xs uppercase tracking-wider hover:border-black hover:text-black transition"
                  >
                    <Smile size={14} />
                    Test Label
                  </button>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>

      {/* Add spacing at the bottom on mobile to account for the sticky bottom nav bar */}
      <div className="h-24 sm:hidden" />

      {/* Mobile Sticky Bottom Nav Bar (Thumb Zone) */}
      {isAdmin && (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t-[3px] border-black bg-white/95 p-4 backdrop-blur-sm sm:hidden no-print shadow-[0_-4px_12px_rgba(0,0,0,0.08)]">
          <div className="mx-auto flex max-w-md items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => void copyPrinterLink()}
              disabled={printerLinkState === "working" || !productionId || !isSupabaseBacked}
              className={`${
                printerLinkState === "copied" ? customPrimaryBtn : customSecondaryBtn
              } flex-1`}
            >
              {printerLinkState === "working" ? (
                <Loader2 size={18} className="animate-spin" />
              ) : printerLinkState === "copied" ? (
                <CheckCircle2 size={18} />
              ) : (
                <Clipboard size={18} />
              )}
              {printerLinkState === "copied" ? "Link Copied" : "Copy Link"}
            </button>
            <button
              type="button"
              onClick={() => void downloadSelected()}
              disabled={busy || !labels.length}
              className={customPrimaryBtn + " flex-1"}
            >
              <Download size={18} />
              {busy ? "Exporting…" : `PNG (${selectedCount})`}
            </button>
          </div>
        </div>
      )}
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
      className={`grid min-h-20 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border-[3px] p-3 text-left transition active:translate-y-px ${
        selected
          ? "border-black bg-black text-white shadow-[2px_2px_0_#000]"
          : "border-black bg-white text-black shadow-[2px_2px_0_#000] hover:shadow-[4px_4px_0_#000]"
      }`}
      aria-pressed={selected}
    >
      <Avatar person={item.person} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-base font-black uppercase tracking-tight leading-tight">
          {item.person.name}
        </span>
        <span
          className={`mt-0.5 block truncate text-xs font-semibold leading-tight ${
            selected ? "text-zinc-300" : "text-zinc-600"
          }`}
        >
          {formatDrink(item.order)}
        </span>
        <span className="mt-2 flex max-w-full flex-wrap gap-1.5">
          <span
            className={`inline-flex max-w-full rounded-md border-2 px-1.5 py-0.5 text-[10px] font-bold leading-none uppercase ${
              selected
                ? "border-white/30 bg-white/10 text-white"
                : "border-black bg-zinc-100 text-zinc-700"
            }`}
          >
            <span className="truncate">{group}</span>
          </span>
          {item.order.label_printed && (
            <span
              className={`inline-flex rounded-md border-2 px-1.5 py-0.5 text-[10px] font-bold leading-none uppercase ${
                selected
                  ? "border-white/30 bg-white/10 text-white"
                  : "border-black bg-emerald-100 text-emerald-800"
              }`}
            >
              Printed
            </span>
          )}
        </span>
      </span>
      <span
        className={`grid size-7 place-items-center rounded-md border-2 shrink-0 ${
          selected ? "border-white bg-white text-black" : "border-black bg-white"
        }`}
        aria-hidden="true"
      >
        {selected ? <CheckCircle2 size={16} /> : null}
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
