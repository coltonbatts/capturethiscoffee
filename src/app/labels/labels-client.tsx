"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
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
import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import { AppShell } from "@/components/app-shell";
import { ScreenLabel } from "@/components/coffee-label-renderer";
import { useAppAuth } from "@/components/app-auth-provider";
import {
  Avatar,
  EmptyState,
  Field,
  alertErrorClass,
  alertStatusClass,
  inputClass,
  pageHeaderClass,
  pageIntroClass,
  pageTitleClass,
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
  reconcileLabelExportSelection,
  niimbotBatchCsv,
  unprintedOrderIds,
} from "@/lib/label-export";
import {
  mintProductionShareTokenAction,
  updateOrderAction,
} from "@/app/operator-actions";
import { describeDataError } from "@/lib/data-errors";
import { unwrapOperatorAction } from "@/lib/operator-inputs";
import { buildProductionShareUrl } from "@/lib/share-links";
import { formatDrink } from "@/lib/order-summary";
import {
  niimbotM2ExportFileName,
  renderNiimbotM2LabelPngBlob,
} from "@/lib/niimbot-m2-export";
import {
  defaultLabelDesignId,
  getBundledLabelTemplate,
} from "@/lib/label-template-catalog";
import type { CoffeeData } from "@/lib/types";
import type { CoffeeLabel } from "@/lib/label-copy";
import type { ProductionLabelTemplateSelection } from "@/lib/label-template-schema";

type ShareNavigator = Navigator & {
  canShare?: (data: { files?: File[] }) => boolean;
  share?: (data: {
    files?: File[];
    title?: string;
    text?: string;
  }) => Promise<void>;
};

const customPrimaryBtn = primaryButtonClass;
const customSecondaryBtn = secondaryButtonClass;

export function LabelsClient({
  initialData,
  initialProductionTemplates,
  initialError = "",
  requestedProductionId = "",
  requestedOrderId = "",
}: {
  initialData: CoffeeData | null;
  initialProductionTemplates: Record<
    string,
    ProductionLabelTemplateSelection
  >;
  initialError?: string;
  requestedProductionId?: string;
  requestedOrderId?: string;
}) {
  const router = useRouter();
  const { isAdmin } = useAppAuth();
  const firstSelection = initialData
    ? initialLabelExportSelection(
        initialData,
        requestedOrderId,
        requestedProductionId,
      )
    : { productionId: "", selectedOrderIds: [] };
  const [data, setData] = useState<CoffeeData | null>(initialData);
  const [error, setError] = useState(initialError);
  const [previousInitialData, setPreviousInitialData] = useState(initialData);
  const [previousInitialError, setPreviousInitialError] = useState(initialError);
  const [status, setStatus] = useState("");
  const [productionId, setProductionId] = useState(firstSelection.productionId);
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>(
    firstSelection.selectedOrderIds,
  );
  const [busy, setBusy] = useState(false);
  const [printerLink, setPrinterLink] = useState("");
  const [printerLinkState, setPrinterLinkState] = useState<
    "idle" | "working" | "copied"
  >("idle");
  const shareReady = useSyncExternalStore(
    subscribeToBrowserCapability,
    getWebShareSnapshot,
    getServerWebShareSnapshot,
  );
  const loadData = useCallback(() => {
    router.refresh();
  }, [router]);

  if (
    initialData !== previousInitialData ||
    initialError !== previousInitialError
  ) {
    setPreviousInitialData(initialData);
    setPreviousInitialError(initialError);
    setError(initialError);
    if (initialData) {
      setData(initialData);
      setStatus("");
      const nextSelection = reconcileLabelExportSelection(initialData, {
        productionId,
        selectedOrderIds,
      });
      setProductionId(nextSelection.productionId);
      setSelectedOrderIds(nextSelection.selectedOrderIds);
    } else if (!data) {
      setData(null);
    }
  }

  const productions = useMemo(
    () => (data ? labelExportProductions(data) : []),
    [data],
  );
  const activeItems = useMemo(
    () =>
      data && productionId
        ? labelExportItemsForProduction(data, productionId)
        : [],
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
  const assignedTemplateVersion = selectedProduction
    ? initialProductionTemplates[selectedProduction.id]
    : undefined;
  const designSelection =
    assignedTemplateVersion?.definition ||
    getBundledLabelTemplate(defaultLabelDesignId).definition;
  const designLabel =
    assignedTemplateVersion?.label || "Grid 01 / v1 legacy fallback";
  const testLabel = useMemo(
    () =>
      selection
        ? buildClientTestLabel(
            selection.client?.name || selection.production.name,
          )
        : null,
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
      setError("Choose a production before creating a Capture This link.");
      return;
    }
    setPrinterLinkState("working");
    setError("");
    setStatus("");

    try {
      const { token } = unwrapOperatorAction(
        await mintProductionShareTokenAction(productionId, "ctc-printer"),
      );
      const url = buildProductionShareUrl(
        window.location.origin,
        productionId,
        token,
      );
      setPrinterLink(url);
      try {
        await writeClipboardText(url);
        setPrinterLinkState("copied");
        setStatus("Capture This link copied to clipboard.");
      } catch {
        setPrinterLinkState("idle");
        setStatus("Printer link created. Select and copy it below.");
      }
    } catch (err) {
      setPrinterLinkState("idle");
      setError(
        describeDataError(err, "Could not create the Capture This link."),
      );
    }
  }

  async function copyExistingPrinterLink(url: string) {
    try {
      await writeClipboardText(url);
      setPrinterLinkState("copied");
      setStatus("Capture This link copied.");
      setError("");
    } catch (err) {
      setError(describeDataError(err, "Could not copy the Capture This link."));
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

  const allSelected =
    activeItems.length > 0 && selectedCount >= activeItems.length;
  const unprintedIds = useMemo(
    () => unprintedOrderIds(activeItems),
    [activeItems],
  );

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
        const updated = unwrapOperatorAction(
          await updateOrderAction(orderId, { label_printed: true }),
        );
        next = {
          ...next,
          orders: next.orders.map((item) =>
            item.id === updated.id ? updated : item,
          ),
        };
      }
      setData(next);
      router.refresh();
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
        const blob = await renderNiimbotM2LabelPngBlob(label, designSelection);
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
      const blob = await renderNiimbotM2LabelPngBlob(
        testLabel,
        designSelection,
      );
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
          const blob = await renderNiimbotM2LabelPngBlob(
            label,
            designSelection,
          );
          return new File([blob], niimbotM2ExportFileName(label), {
            type: "image/png",
          });
        }),
      );

      if (
        typeof shareNavigator.canShare === "function" &&
        !shareNavigator.canShare({ files })
      ) {
        setStatus(
          "This device cannot share these files. Use Download instead.",
        );
        return;
      }

      await shareNavigator.share({
        files,
        title: "Capture This labels",
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
    <AppShell title="Labels" breadcrumbs={[{ label: "Labels" }]} requireAuth>
      <div className="mx-auto w-full max-w-md px-1 sm:max-w-xl sm:px-0 md:max-w-5xl">
        <header className={pageHeaderClass}>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h1 className={pageTitleClass}>
                Labels
              </h1>
              <p className={pageIntroClass}>
                Manage print queues, select drink labels, and connect to CTC
                Printer.
              </p>
            </div>
            <Link
              href="/productions"
              className={`${customSecondaryBtn} hidden sm:inline-flex min-h-11 py-0 px-4 text-xs`}
            >
              Days
            </Link>
          </div>
        </header>

        {error ? (
          <div className={`${alertErrorClass} mb-4 flex flex-wrap items-center justify-between gap-3`} role="alert">
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
          <p className={`${alertStatusClass} mb-4`} role="status">
            {status}
          </p>
        ) : null}

        <section className="mb-6 rounded-xl border border-black/15 bg-[#fffdf8] p-5 sm:p-6">
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <Printer size={22} className="text-black" />
              <h2 className="text-lg font-semibold tracking-[-0.025em] text-black">
                Capture This legacy link
              </h2>
            </div>
            <p className="text-sm font-semibold text-zinc-600">
              {selectedProduction
                ? `${selectedProduction.name}: ${activeItems.length} labels, ${unprintedIds.length} remaining.`
                : "Choose a production day to load the printer queue."}
            </p>

            <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
              <Field label="Selected day">
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
                  disabled={printerLinkState === "working" || !productionId}
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
                  className="text-xs font-semibold text-zinc-500"
                >
                  Link URL (paste into Capture This · Advanced · Legacy link)
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
          </div>
        </section>

        <div className="grid gap-6 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] items-start">
          <section className="flex flex-col gap-4 rounded-xl border border-black/15 bg-[#fffdf8] p-5">
            <div className="flex items-center justify-between gap-3 min-w-0">
              <h2 className="flex-1 truncate text-lg font-semibold tracking-[-0.025em] text-black">
                Print queue
              </h2>
              <div className="flex gap-1.5 shrink-0">
                {unprintedIds.length > 0 &&
                  unprintedIds.length < activeItems.length && (
                    <button
                      type="button"
                      onClick={selectUnprinted}
                      className={`${secondaryButtonClass} min-h-11 px-2.5 text-xs`}
                    >
                      Unprinted ({unprintedIds.length})
                    </button>
                  )}
                <button
                  type="button"
                  onClick={toggleSelectAll}
                  className={`${secondaryButtonClass} min-h-11 px-2.5 text-xs`}
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

          <div className="flex flex-col gap-6">
            <section className="flex flex-col gap-4 rounded-xl border border-black/15 bg-[#fffdf8] p-5">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-black/15 pb-3">
                <div>
                  <p className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-500">
                    Frozen production version
                  </p>
                  <h2 className="mt-1 text-lg font-semibold tracking-[-0.025em] text-black">
                    {designLabel}
                  </h2>
                  <p className="mt-1 text-sm font-semibold leading-snug text-zinc-600">
                    Screen proof and PNG export use this exact immutable
                    definition.
                  </p>
                </div>
                <Link
                  href="/labels/templates"
                  className={`${customSecondaryBtn} min-h-10 px-3 py-0 text-xs`}
                >
                  Manage templates
                </Link>
              </div>

              <div
                className="grid aspect-[5/3] w-full min-w-0 place-items-center overflow-hidden rounded-xl border border-black/15 bg-[#ebe7de] p-4"
              >
                {previewLabel ? (
                  <div className="flex w-full min-w-0 justify-center">
                    <ScreenLabel
                      label={previewLabel}
                      design={designSelection}
                    />
                  </div>
                ) : (
                  <p className="text-center text-xs font-medium text-zinc-500">
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
                    className={`${secondaryButtonClass} min-h-11 text-xs`}
                  >
                    <FileSpreadsheet size={14} />
                    CSV Export
                  </button>
                  <button
                    type="button"
                    onClick={() => void downloadTestLabel()}
                    disabled={busy || !testLabel}
                    className={`${secondaryButtonClass} min-h-11 text-xs`}
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

      <div className="h-24 sm:hidden" />

      {isAdmin && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-black/15 bg-[#f7f3ea]/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-md no-print sm:hidden">
          <div className="mx-auto flex max-w-md items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => void copyPrinterLink()}
              disabled={printerLinkState === "working" || !productionId}
              className={`${
                printerLinkState === "copied"
                  ? customPrimaryBtn
                  : customSecondaryBtn
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
      className={`grid min-h-20 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border p-3 text-left transition-[border-color,background-color,color,transform] active:translate-y-px ${
        selected
          ? "border-black bg-black text-white"
          : "border-black/15 bg-transparent text-black hover:border-black hover:bg-white"
      }`}
      aria-pressed={selected}
    >
      <Avatar person={item.person} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-base font-semibold leading-tight tracking-[-0.025em]">
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
            className={`inline-flex max-w-full rounded-full border px-2 py-1 text-[10px] font-semibold leading-none ${
              selected
                ? "border-white/30 bg-white/10 text-white"
                : "border-black/15 bg-black/[0.04] text-zinc-700"
            }`}
          >
            <span className="truncate">{group}</span>
          </span>
          {item.order.label_printed && (
            <span
              className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-semibold leading-none ${
                selected
                  ? "border-white/30 bg-white/10 text-white"
                  : "border-emerald-800/25 bg-emerald-50 text-emerald-900"
              }`}
            >
              Printed
            </span>
          )}
        </span>
      </span>
      <span
        className={`grid size-7 shrink-0 place-items-center rounded-full border ${
          selected
            ? "border-white bg-white text-black"
            : "border-black bg-white"
        }`}
        aria-hidden="true"
      >
        {selected ? <CheckCircle2 size={16} /> : null}
      </span>
    </button>
  );
}

function subscribeToBrowserCapability() {
  return () => {};
}

function getWebShareSnapshot() {
  return typeof (navigator as ShareNavigator).share === "function";
}

function getServerWebShareSnapshot() {
  return false;
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
    throw new Error(
      "Clipboard access is unavailable. Select and copy the link manually.",
    );
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
