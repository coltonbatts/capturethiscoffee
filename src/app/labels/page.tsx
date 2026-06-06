"use client";

import Link from "next/link";
import {
  BadgePlus,
  CheckCircle2,
  Clipboard,
  Coffee,
  Layers2,
  PencilLine,
  Printer,
  RotateCcw,
  Settings,
  UserRound,
} from "lucide-react";
import { type CSSProperties, useEffect, useMemo, useState } from "react";
import { CaptureAngle } from "@/components/capture-mark";
import { AppShell } from "@/components/app-shell";
import {
  Avatar,
  Field,
  Panel,
  inputClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/ui";
import {
  buildCoffeeLabels,
  defaultLabelFields,
  labelsToText,
  type CoffeeLabel,
  type LabelContentStyle,
  type LabelFieldOptions,
} from "@/lib/label-copy";
import { loadCoffeeData, resetDemoCoffeeData, updateOrderRecord } from "@/lib/data";
import { formatDrink } from "@/lib/order-summary";
import { probeNiimbotBluetooth } from "@/lib/niimbot-web-bluetooth";
import {
  loadPrintCalibration,
  savePrintCalibration,
  type PrintCalibration,
} from "@/lib/label-calibration";
import { buildLabelPrintJobPayload } from "@/lib/print-jobs";
import { getAppAccessToken } from "@/lib/auth";
import {
  getSupabaseBrowserClient,
  isSupabaseConfigured,
} from "@/lib/supabase";
import type { CoffeeData, Order, RosterOrder } from "@/lib/types";

type LabelDraft = {
  personName: string;
  group: string;
  productionName: string;
  clientName: string;
  size: string;
  temperature: string;
  drinkType: string;
  milkType: string;
  sweetener: string;
  caffeine: string;
  specialNotes: string;
};

const blankDraft: LabelDraft = {
  personName: "",
  group: "Set",
  productionName: "Today on set",
  clientName: "",
  size: "Medium",
  temperature: "Iced",
  drinkType: "Latte",
  milkType: "Oat",
  sweetener: "",
  caffeine: "Regular",
  specialNotes: "",
};

const quickDrinks = [
  { label: "Iced oat latte", drinkType: "Latte", temperature: "Iced", milkType: "Oat" },
  { label: "Cold brew", drinkType: "Cold brew", temperature: "Iced", milkType: "" },
  { label: "Americano", drinkType: "Americano", temperature: "Hot", milkType: "" },
  { label: "Drip coffee", drinkType: "Drip coffee", temperature: "Hot", milkType: "" },
  { label: "Matcha", drinkType: "Matcha latte", temperature: "Iced", milkType: "Almond" },
];

const fieldLabels: Array<[keyof LabelFieldOptions, string]> = [
  ["personName", "Name"],
  ["drink", "Drink"],
  ["group", "Group"],
  ["productionClient", "Shoot"],
  ["notesStatus", "Notes"],
];

type PrintSheetStyle = CSSProperties &
  Record<"--m2-print-offset-x" | "--m2-print-offset-y" | "--m2-print-scale", string>;

export default function LabelWorkstationPage() {
  const [data, setData] = useState<CoffeeData | null>(null);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState("manual");
  const [draft, setDraft] = useState<LabelDraft>(blankDraft);
  const [style, setStyle] = useState<LabelContentStyle>("standard");
  const [fields, setFields] = useState<LabelFieldOptions>(defaultLabelFields);
  const [printing, setPrinting] = useState(false);
  const [queueing, setQueueing] = useState(false);
  const [queueStatus, setQueueStatus] = useState("");
  const [copied, setCopied] = useState(false);
  const [printerProbe, setPrinterProbe] = useState("");
  const [checkingPrinter, setCheckingPrinter] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  const [printLabels, setPrintLabels] = useState<CoffeeLabel[]>([]);
  const [pendingPrintedOrderId, setPendingPrintedOrderId] = useState("");
  const [pendingAdvance, setPendingAdvance] = useState(false);
  const [calibration, setCalibration] = useState<PrintCalibration>(loadPrintCalibration);

  useEffect(() => {
    let mounted = true;
    loadCoffeeData()
      .then((next) => {
        if (!mounted) return;
        setData(next);
        const firstProduction = preferredProduction(next);
        const client = next.clients.find(
          (item) => item.id === firstProduction?.client_id,
        );
        const firstPrintable = firstProduction
          ? rosterOrdersForProduction(next, firstProduction.id).find(isUnprintedPrintable)
          : undefined;

        if (firstProduction && firstPrintable?.order) {
          setSelectedId(firstPrintable.order.id);
          setDraft(draftFromRosterItem(next, firstProduction, firstPrintable));
          return;
        }

        setDraft((current) => ({
          ...current,
          productionName: firstProduction?.name || current.productionName,
          clientName: client?.name || "",
        }));
      })
      .catch((err: Error) => {
        if (mounted) setError(err.message);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const production = data ? preferredProduction(data) : undefined;
  const rosterItems = useMemo(
    () => (data && production ? rosterOrdersForProduction(data, production.id) : []),
    [data, production],
  );
  const selectedItem = rosterItems.find((item) => item.order?.id === selectedId);
  const printableItems = useMemo(
    () => rosterItems.filter(isPrintableOrder),
    [rosterItems],
  );
  const unprintedItems = useMemo(
    () => printableItems.filter(isUnprintedPrintable),
    [printableItems],
  );
  const options = useMemo(() => ({ style, fields }), [fields, style]);
  const currentLabel = useMemo(
    () =>
      buildCoffeeLabels(
        { name: draft.productionName || "Today on set" },
        draft.clientName ? { name: draft.clientName } : undefined,
        [draftRosterOrder(draft, selectedId)],
        options,
      )[0],
    [draft, options, selectedId],
  );
  const printSheetStyle = useMemo<PrintSheetStyle>(
    () => ({
      "--m2-print-offset-x": `${calibration.offsetX}mm`,
      "--m2-print-offset-y": `${calibration.offsetY}mm`,
      "--m2-print-scale": String(calibration.scale / 100),
    }),
    [calibration],
  );

  function updateDraft(patch: Partial<LabelDraft>) {
    setDraft((current) => ({ ...current, ...patch }));
  }

  function updateCalibration(patch: Partial<PrintCalibration>) {
    setCalibration((current) => {
      const next = { ...current, ...patch };
      savePrintCalibration(next);
      return next;
    });
  }

  function chooseOrder(orderId: string) {
    setSelectedId(orderId);
    setPendingPrintedOrderId("");
    setPendingAdvance(false);

    if (orderId === "manual") {
      setDraft((current) => ({
        ...blankDraft,
        productionName: current.productionName,
        clientName: current.clientName,
      }));
      return;
    }

    const item = rosterItems.find((entry) => entry.order?.id === orderId);
    if (!item?.order) return;
    if (data && production) setDraft(draftFromRosterItem(data, production, item));
  }

  async function printCurrent({ advance }: { advance: boolean }) {
    if (!currentLabel || !draft.personName.trim()) {
      setError("Enter a name before printing.");
      return;
    }

    setPrinting(true);
    setError("");
    setPendingPrintedOrderId("");
    setPendingAdvance(false);

    try {
      if (data && selectedItem?.order) {
        const next = await updateOrderRecord(data, selectedItem.order.id, {
          ...draftOrderPatch(draft),
          status: selectedItem.order.status === "not_asked" ? "confirmed" : selectedItem.order.status,
        });
        setData(next);
        setPendingPrintedOrderId(selectedItem.order.id);
        setPendingAdvance(advance);
      }

      setPrintLabels([currentLabel]);
      setRecent((current) => [
        `${currentLabel.personName} - ${currentLabel.drink}`,
        ...current.filter((item) => item !== `${currentLabel.personName} - ${currentLabel.drink}`),
      ].slice(0, 5));

      window.setTimeout(() => window.print(), 60);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not prepare that label.");
    } finally {
      window.setTimeout(() => setPrinting(false), 300);
    }
  }

  async function queueCurrentLabel() {
    if (!currentLabel || !draft.personName.trim()) {
      setError("Enter a name before queueing.");
      return;
    }

    if (!isSupabaseConfigured) {
      setError("Print job queue requires Supabase auth.");
      return;
    }

    setQueueing(true);
    setQueueStatus("");
    setError("");

    try {
      let nextData = data;
      const selectedOrder = selectedItem?.order;

      if (data && selectedOrder) {
        nextData = await updateOrderRecord(data, selectedOrder.id, {
          ...draftOrderPatch(draft),
          status:
            selectedOrder.status === "not_asked"
              ? "confirmed"
              : selectedOrder.status,
        });
        setData(nextData);
      }

      const token = await getAccessToken();
      const payload = buildLabelPrintJobPayload({
        productionId: selectedOrder?.production_id || production?.id || null,
        orderId: selectedOrder?.id || null,
        personId: selectedOrder?.person_id || selectedItem?.person.id || null,
        label: currentLabel,
        options,
      });

      const response = await fetch("/api/print-jobs", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          production_id: payload.source.production_id,
          order_id: payload.source.order_id,
          person_id: payload.source.person_id,
          payload,
          copies: 1,
        }),
      });
      const body = await response.json();

      if (!response.ok) {
        throw new Error(body.error || "Could not queue that label.");
      }

      const jobId = body.jobs?.[0]?.id;
      setQueueStatus(
        jobId
          ? `Queued ${currentLabel.personName} (${jobId.slice(0, 8)}).`
          : `Queued ${currentLabel.personName}.`,
      );
      setRecent((current) => [
        `Queued: ${currentLabel.personName} - ${currentLabel.drink}`,
        ...current,
      ].slice(0, 5));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not queue that label.");
    } finally {
      setQueueing(false);
    }
  }

  function printCalibrationLabel() {
    setPrinting(true);
    setError("");
    setPendingPrintedOrderId("");
    setPendingAdvance(false);
    setPrintLabels([calibrationLabel(calibration)]);
    window.setTimeout(() => window.print(), 60);
    window.setTimeout(() => setPrinting(false), 300);
  }

  async function markPendingPrinted() {
    if (!data || !pendingPrintedOrderId) return;

    setPrinting(true);
    setError("");

    try {
      const next = await updateOrderRecord(data, pendingPrintedOrderId, {
        label_printed: true,
      });
      setData(next);

      const shouldAdvance = pendingAdvance;
      const printedOrderId = pendingPrintedOrderId;
      setPendingPrintedOrderId("");
      setPendingAdvance(false);

      if (shouldAdvance) {
        const nextOrderId = nextPrintableOrderId(rosterItems, printedOrderId);
        if (nextOrderId) chooseOrder(nextOrderId);
        else chooseOrder("manual");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not mark label printed.");
    } finally {
      window.setTimeout(() => setPrinting(false), 200);
    }
  }

  async function copyCurrent() {
    if (!currentLabel) return;
    try {
      await navigator.clipboard.writeText(labelsToText([currentLabel], options));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      setError("Couldn't copy automatically. Select the preview text instead.");
    }
  }

  async function resetDemo() {
    const next = await resetDemoCoffeeData();
    setData(next);
    const first = preferredProduction(next);
    const firstItem = first
      ? rosterOrdersForProduction(next, first.id).find(isUnprintedPrintable)
      : undefined;
    if (first && firstItem?.order) {
      setSelectedId(firstItem.order.id);
      setDraft(draftFromRosterItem(next, first, firstItem));
      return;
    }
    setSelectedId("manual");
    const client = next.clients.find((item) => item.id === first?.client_id);
    setDraft({
      ...blankDraft,
      productionName: first?.name || blankDraft.productionName,
      clientName: client?.name || "",
    });
  }

  async function checkPrinter() {
    if (checkingPrinter) return;
    setCheckingPrinter(true);
    setPrinterProbe("");
    const result = await probeNiimbotBluetooth();
    setPrinterProbe(
      [
        result.ok ? "M2 check passed." : "M2 check did not complete.",
        result.deviceName ? `Device: ${result.deviceName}.` : "",
        result.characteristicUuid ? `Characteristic: ${result.characteristicUuid}.` : "",
        result.message,
      ]
        .filter(Boolean)
        .join(" "),
    );
    setCheckingPrinter(false);
  }

  return (
    <AppShell title="Label workstation">
      <div className="grid gap-4 no-print">
        <section className="grid gap-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm shadow-black/5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div>
            <h1 className="text-2xl font-black leading-tight tracking-normal text-black md:text-3xl">
              Active shoot labels
            </h1>
            <p className="mt-1 text-sm font-medium text-zinc-600">
              {production
                ? `${production.name}${production.location ? ` at ${production.location}` : ""}`
                : "Load the active production, tap a face, print, and move."}
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 rounded-xl border border-zinc-200 bg-zinc-50 p-2 text-center">
            <Metric value={printableItems.length || 0} label="Printable" />
            <Metric
              value={rosterItems.filter((item) => item.order?.label_printed).length}
              label="Printed"
            />
            <Metric value={unprintedItems.length} label="Open" />
          </div>
        </section>

        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-800">
            {error}
          </div>
        ) : null}

        <Panel className="grid gap-3 p-3 sm:p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-bold">
                <UserRound size={19} aria-hidden="true" />
                Shoot queue
              </h2>
              <p className="mt-1 text-sm text-zinc-600">
                First unprinted order is selected automatically.
              </p>
            </div>
            <button
              type="button"
              onClick={() => chooseOrder("manual")}
              className={`${secondaryButtonClass} min-h-10 px-3`}
            >
              <PencilLine size={17} aria-hidden="true" />
              Manual
            </button>
          </div>

          {printableItems.length ? (
            <div className="flex snap-x gap-3 overflow-x-auto pb-1 sm:grid sm:grid-cols-2 sm:overflow-visible lg:grid-cols-3 xl:grid-cols-4">
              {printableItems.map((item) => (
                <QueueCard
                  key={item.order?.id || item.roster.id}
                  item={item}
                  selected={item.order?.id === selectedId}
                  onSelect={() => item.order && chooseOrder(item.order.id)}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-4 text-sm font-medium text-zinc-600">
              No printable orders are loaded for this active shoot. Use Manual to
              print a one-off label.
            </div>
          )}
        </Panel>

        <div className="grid gap-4 xl:grid-cols-[minmax(320px,0.9fr)_minmax(360px,1.1fr)_minmax(280px,0.75fr)]">
          <Panel className="grid gap-4 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="flex items-center gap-2 text-lg font-bold">
                  <UserRound size={19} aria-hidden="true" />
                  Manual fallback
                </h2>
                <p className="mt-1 text-sm text-zinc-600">
                  Adjust the selected order or type a one-off cup label.
                </p>
              </div>
              <button
                type="button"
                onClick={resetDemo}
                className={`${secondaryButtonClass} min-w-11 px-3`}
                aria-label="Reset demo data"
              >
                <RotateCcw size={18} aria-hidden="true" />
              </button>
            </div>

            <Field label="Person or cup">
              <select
                className={inputClass}
                value={selectedId}
                onChange={(event) => chooseOrder(event.target.value)}
              >
                <option value="manual">Manual label</option>
                {printableItems.map((item) =>
                  item.order ? (
                    <option key={item.order.id} value={item.order.id}>
                      {item.person.name} - {formatDrink(item.order)}
                    </option>
                  ) : null,
                )}
              </select>
            </Field>

            <Field label="Name on label">
              <input
                className={inputClass}
                value={draft.personName}
                onChange={(event) => updateDraft({ personName: event.target.value })}
                placeholder="Ava, Client 2, Director..."
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Group">
                <input
                  className={inputClass}
                  value={draft.group}
                  onChange={(event) => updateDraft({ group: event.target.value })}
                />
              </Field>
              <Field label="Size">
                <select
                  className={inputClass}
                  value={draft.size}
                  onChange={(event) => updateDraft({ size: event.target.value })}
                >
                  <option value="">Any</option>
                  <option>Small</option>
                  <option>Medium</option>
                  <option>Large</option>
                </select>
              </Field>
            </div>

            <div className="flex gap-2 overflow-x-auto pb-1">
              {quickDrinks.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => updateDraft(item)}
                  className="min-h-10 shrink-0 rounded-xl border border-zinc-300 bg-white px-3 text-sm font-semibold text-zinc-800 hover:bg-zinc-50"
                >
                  {item.label}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Temp">
                <select
                  className={inputClass}
                  value={draft.temperature}
                  onChange={(event) => updateDraft({ temperature: event.target.value })}
                >
                  <option value="">Any</option>
                  <option>Hot</option>
                  <option>Iced</option>
                </select>
              </Field>
              <Field label="Drink">
                <input
                  className={inputClass}
                  value={draft.drinkType}
                  onChange={(event) => updateDraft({ drinkType: event.target.value })}
                />
              </Field>
              <Field label="Milk">
                <input
                  className={inputClass}
                  value={draft.milkType}
                  onChange={(event) => updateDraft({ milkType: event.target.value })}
                  placeholder="Oat, whole..."
                />
              </Field>
              <Field label="Sweetener">
                <input
                  className={inputClass}
                  value={draft.sweetener}
                  onChange={(event) => updateDraft({ sweetener: event.target.value })}
                  placeholder="Half sweet..."
                />
              </Field>
            </div>

            <Field label="Notes">
              <input
                className={inputClass}
                value={draft.specialNotes}
                onChange={(event) => updateDraft({ specialNotes: event.target.value })}
                placeholder="No room, decaf, extra hot..."
              />
            </Field>
          </Panel>

          <Panel className="grid gap-4 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="flex items-center gap-2 text-lg font-bold">
                  <Coffee size={19} aria-hidden="true" />
                  Preview
                </h2>
                <p className="mt-1 text-sm text-zinc-600">
                  This is the 50mm x 30mm browser print label.
                </p>
              </div>
              {selectedItem?.order?.label_printed ? (
                <span className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 text-xs font-bold text-emerald-950">
                  <CheckCircle2 size={15} aria-hidden="true" />
                  Printed
                </span>
              ) : null}
            </div>

            <div className="grid min-h-[260px] place-items-center overflow-hidden rounded-2xl border border-zinc-200 bg-[linear-gradient(135deg,#f8fafc_0%,#f8fafc_48%,#eef2f7_48%,#eef2f7_52%,#f8fafc_52%)] p-3 sm:min-h-[320px] sm:p-4">
              {currentLabel ? <ScreenLabel label={currentLabel} /> : null}
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <button
                type="button"
                onClick={() => void printCurrent({ advance: true })}
                disabled={printing}
                className={`${primaryButtonClass} col-span-2 min-h-14 text-base sm:col-span-2`}
              >
                <Printer size={20} aria-hidden="true" />
                {printing ? "Printing..." : "Print & next"}
              </button>
              <button
                type="button"
                onClick={() => void queueCurrentLabel()}
                disabled={queueing || printing}
                className={`${secondaryButtonClass} min-h-14`}
              >
                <BadgePlus size={18} aria-hidden="true" />
                {queueing ? "Queueing" : "Queue"}
              </button>
              <button
                type="button"
                onClick={() => void printCurrent({ advance: false })}
                disabled={printing}
                className={`${secondaryButtonClass} min-h-14`}
              >
                <Printer size={18} aria-hidden="true" />
                Print
              </button>
              <button
                type="button"
                onClick={copyCurrent}
                className={`${secondaryButtonClass} min-h-14 sm:col-start-4`}
              >
                <Clipboard size={18} aria-hidden="true" />
                {copied ? "Copied" : "Copy"}
              </button>
            </div>

            {queueStatus ? (
              <p className="rounded-xl border border-sky-200 bg-sky-50 p-3 text-sm font-semibold text-sky-950">
                {queueStatus}
              </p>
            ) : null}

            {pendingPrintedOrderId ? (
              <div className="grid gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
                <p className="text-sm font-semibold leading-5 text-amber-950">
                  After the browser print dialog finishes, confirm only if the label
                  came out correctly.
                </p>
                <button
                  type="button"
                  onClick={() => void markPendingPrinted()}
                  disabled={printing}
                  className={primaryButtonClass}
                >
                  <CheckCircle2 size={18} aria-hidden="true" />
                  {pendingAdvance ? "Mark printed & next" : "Mark printed"}
                </button>
              </div>
            ) : null}
          </Panel>

          <div className="grid gap-4">
            <Panel className="grid gap-4 p-4">
              <h2 className="flex items-center gap-2 text-lg font-bold">
                <PencilLine size={19} aria-hidden="true" />
                Layout
              </h2>
              <Field label="Content density">
                <select
                  className={inputClass}
                  value={style}
                  onChange={(event) =>
                    setStyle(event.target.value as LabelContentStyle)
                  }
                >
                  <option value="compact">Compact</option>
                  <option value="standard">Standard</option>
                  <option value="detailed">Detailed</option>
                </select>
              </Field>
              <div className="grid grid-cols-2 gap-2">
                {fieldLabels.map(([key, label]) => (
                  <label
                    key={key}
                    className="flex min-h-11 items-center gap-2 rounded-xl border border-zinc-300 bg-white px-3 text-sm font-semibold text-zinc-800"
                  >
                    <input
                      type="checkbox"
                      checked={fields[key]}
                      onChange={() =>
                        setFields((current) => ({
                          ...current,
                          [key]: !current[key],
                        }))
                      }
                      className="size-4 accent-black"
                    />
                    {label}
                  </label>
                ))}
              </div>
            </Panel>

            <Panel className="grid gap-3 p-4">
              <h2 className="flex items-center gap-2 text-lg font-bold">
                <Printer size={19} aria-hidden="true" />
                Printer
              </h2>
              <PrinterCalibrationChecklist />
              <PrinterCalibrationControls
                calibration={calibration}
                disabled={printing}
                onChange={updateCalibration}
                onPrint={printCalibrationLabel}
              />
              <button
                type="button"
                onClick={checkPrinter}
                className={secondaryButtonClass}
                disabled={checkingPrinter}
              >
                <Printer size={18} aria-hidden="true" />
                {checkingPrinter ? "Checking..." : "Experimental M2 check"}
              </button>
              {printerProbe ? (
                <p
                  className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm font-medium leading-6 text-zinc-700"
                  aria-live="polite"
                >
                  {printerProbe}
                </p>
              ) : null}
            </Panel>

            <Panel className="grid gap-3 p-4">
              <h2 className="flex items-center gap-2 text-lg font-bold">
                <Layers2 size={19} aria-hidden="true" />
                Setup
              </h2>
              <Link href="/productions" className={secondaryButtonClass}>
                <Settings size={18} aria-hidden="true" />
                Jobs
              </Link>
              <Link href="/people" className={secondaryButtonClass}>
                <UserRound size={18} aria-hidden="true" />
                People
              </Link>
              <Link href="/productions/new" className={secondaryButtonClass}>
                <BadgePlus size={18} aria-hidden="true" />
                New job
              </Link>
            </Panel>

            {recent.length ? (
              <Panel className="p-4">
                <h2 className="text-lg font-bold">Recent prints</h2>
                <div className="mt-3 grid gap-2">
                  {recent.map((item) => (
                    <p
                      key={item}
                      className="rounded-xl bg-zinc-100 p-3 text-sm font-semibold text-zinc-700"
                    >
                      {item}
                    </p>
                  ))}
                </div>
              </Panel>
            ) : null}
          </div>
        </div>
      </div>

      <section className="print-only hidden">
        <div className="m2-label-sheet" style={printSheetStyle}>
          {(printLabels.length ? printLabels : currentLabel ? [currentLabel] : []).map(
            (label) => (
              <PrintableLabel key={label.id} label={label} />
            ),
          )}
        </div>
      </section>
    </AppShell>
  );
}

function PrinterCalibrationChecklist() {
  return (
    <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm font-medium leading-6 text-zinc-700">
      <p className="font-bold text-black">Browser print setup</p>
      <ul className="mt-1 list-disc space-y-1 pl-5">
        <li>Label stock: 50mm x 30mm.</li>
        <li>Orientation: landscape if the driver asks.</li>
        <li>Scale: 100%, not fit to page.</li>
        <li>Margins: none; default only if none clips.</li>
        <li>Increase density if text is faint; adjust driver alignment if shifted.</li>
      </ul>
      <p className="mt-2 text-xs font-semibold uppercase tracking-normal text-zinc-500">
        NIIMBOT Bluetooth is an experimental check only.
      </p>
    </div>
  );
}

async function getAccessToken() {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) throw new Error("Supabase auth is not available.");
  return getAppAccessToken(supabase);
}

function PrinterCalibrationControls({
  calibration,
  disabled,
  onChange,
  onPrint,
}: {
  calibration: PrintCalibration;
  disabled: boolean;
  onChange: (patch: Partial<PrintCalibration>) => void;
  onPrint: () => void;
}) {
  return (
    <div className="grid gap-3 rounded-xl border border-zinc-200 bg-white p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-black">Physical calibration</p>
          <p className="mt-0.5 text-xs font-medium text-zinc-500">
            Nudge only after the first real M2 print.
          </p>
        </div>
        <button
          type="button"
          onClick={onPrint}
          disabled={disabled}
          className={`${secondaryButtonClass} min-h-10 px-3`}
        >
          <Printer size={17} aria-hidden="true" />
          Test
        </button>
      </div>

      <CalibrationSlider
        label="Left/right"
        value={calibration.offsetX}
        min={-3}
        max={3}
        step={0.5}
        unit="mm"
        onChange={(offsetX) => onChange({ offsetX })}
      />
      <CalibrationSlider
        label="Up/down"
        value={calibration.offsetY}
        min={-3}
        max={3}
        step={0.5}
        unit="mm"
        onChange={(offsetY) => onChange({ offsetY })}
      />
      <CalibrationSlider
        label="Scale"
        value={calibration.scale}
        min={94}
        max={102}
        step={1}
        unit="%"
        onChange={(scale) => onChange({ scale })}
      />
    </div>
  );
}

function CalibrationSlider({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="grid gap-1.5 text-sm font-semibold text-zinc-700">
      <span className="flex items-center justify-between gap-2">
        <span>{label}</span>
        <span className="font-mono text-xs text-zinc-500">
          {value > 0 && unit === "mm" ? "+" : ""}
          {value}
          {unit}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full accent-black"
      />
    </label>
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

function QueueCard({
  item,
  selected,
  onSelect,
}: {
  item: RosterOrder;
  selected: boolean;
  onSelect: () => void;
}) {
  const group = item.roster.group_label || item.person.department || "Set";
  const printed = Boolean(item.order?.label_printed);
  const drink = formatDrink(item.order);

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`grid min-h-32 w-[78vw] max-w-[320px] shrink-0 snap-start grid-cols-[3.25rem_minmax(0,1fr)] gap-3 rounded-xl border p-3 text-left transition active:scale-[0.99] sm:w-auto sm:max-w-none ${
        selected
          ? "border-black bg-black text-white shadow-sm shadow-black/15"
          : printed
            ? "border-emerald-200 bg-emerald-50 text-emerald-950"
            : "border-zinc-200 bg-white text-black hover:border-zinc-400"
      }`}
      aria-pressed={selected}
    >
      <Avatar person={item.person} />
      <span className="grid min-w-0 gap-2">
        <span className="flex min-w-0 items-start justify-between gap-2">
          <span className="min-w-0">
            <span className="block truncate text-base font-black leading-tight">
              {item.person.name}
            </span>
            <span
              className={`mt-1 inline-flex max-w-full rounded-full px-2 py-1 text-xs font-bold ${
                selected
                  ? "bg-white/15 text-white"
                  : "bg-zinc-100 text-zinc-700"
              }`}
            >
              <span className="truncate">{group}</span>
            </span>
          </span>
          <span
            className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[11px] font-black uppercase ${
              printed
                ? selected
                  ? "bg-emerald-400 text-black"
                  : "bg-emerald-600 text-white"
                : selected
                  ? "bg-white text-black"
                  : "bg-black text-white"
            }`}
          >
            {printed ? (
              <CheckCircle2 size={13} aria-hidden="true" />
            ) : (
              <Printer size={13} aria-hidden="true" />
            )}
            {printed ? "Printed" : "Open"}
          </span>
        </span>
        <span
          className={`line-clamp-2 text-sm font-semibold leading-5 ${
            selected ? "text-zinc-200" : "text-zinc-600"
          }`}
        >
          {drink}
        </span>
      </span>
    </button>
  );
}

function ScreenLabel({ label }: { label: CoffeeLabel }) {
  const main = label.title || label.personName;
  const body = label.bodyLines.join(" / ") || label.drink;

  return (
    <div className="screen-label">
      <div className="screen-label-mark">
        <CaptureAngle />
      </div>
      <h3>{main}</h3>
      <p className="screen-label-order">{body}</p>
      <div className="screen-label-footer">
        <span>{label.footerStart}</span>
        <span>{label.footerEnd}</span>
      </div>
    </div>
  );
}

function PrintableLabel({ label }: { label: CoffeeLabel }) {
  const main = label.title || label.personName;
  const body = label.bodyLines.join(" / ") || label.drink;

  return (
    <article className="m2-label">
      <div className="m2-label-mark">
        <CaptureAngle />
      </div>
      <h2>{main}</h2>
      <p className="m2-label-order">{body}</p>
      <div className="m2-label-footer">
        <span>{label.footerStart}</span>
        <span>{label.footerEnd}</span>
      </div>
    </article>
  );
}

function calibrationLabel(calibration: PrintCalibration): CoffeeLabel {
  return {
    id: `m2-calibration-${Date.now()}`,
    personName: "M2 calibration",
    drink: "Border should sit inside the 50mm x 30mm label.",
    group: "Test",
    productionClient: "Capture This Coffee",
    notesStatus: "",
    title: "M2 CALIBRATION",
    bodyLines: [
      "Border inside edge / text readable",
      `X ${signedMillimeters(calibration.offsetX)} / Y ${signedMillimeters(
        calibration.offsetY,
      )} / ${calibration.scale}%`,
    ],
    footerStart: "50 x 30mm",
    footerEnd: "Set scale 100% in dialog",
    lines: [],
  };
}

function signedMillimeters(value: number) {
  return `${value > 0 ? "+" : ""}${value}mm`;
}

function preferredProduction(data: CoffeeData) {
  return (
    data.productions.find((item) => item.status === "active") || data.productions[0]
  );
}

function rosterOrdersForProduction(
  data: CoffeeData,
  productionId: string,
): RosterOrder[] {
  return data.production_roster
    .filter((roster) => roster.production_id === productionId && roster.on_set_today)
    .sort((a, b) => a.sort_order - b.sort_order)
    .flatMap((roster) => {
      const person = data.people.find((item) => item.id === roster.person_id);
      if (!person) return [];

      return [
        {
          roster,
          person,
          order: data.orders.find((order) => order.roster_id === roster.id),
        },
      ];
    });
}

function isPrintableOrder(item: RosterOrder) {
  return Boolean(item.order && item.order.status !== "no_order");
}

function isUnprintedPrintable(item: RosterOrder) {
  return isPrintableOrder(item) && !item.order?.label_printed;
}

function draftFromRosterItem(
  data: CoffeeData,
  production: NonNullable<ReturnType<typeof preferredProduction>>,
  item: RosterOrder,
): LabelDraft {
  const client = data.clients.find((entry) => entry.id === production.client_id);
  const order = item.order;

  return {
    personName: item.person.name,
    group: item.roster.group_label || item.person.department || "Set",
    productionName: production.name || "Today on set",
    clientName: client?.name || "",
    size: order?.size || "",
    temperature: order?.temperature || "",
    drinkType: order?.drink_type || "",
    milkType: order?.milk_type || "",
    sweetener: order?.sweetener || "",
    caffeine: order?.caffeine || "Regular",
    specialNotes: order?.special_notes || "",
  };
}

function draftRosterOrder(draft: LabelDraft, id: string): RosterOrder {
  const order = draftOrderPatch(draft);
  return {
    roster: {
      id: `roster-${id}`,
      production_id: "draft-production",
      person_id: `person-${id}`,
      group_label: draft.group,
      on_set_today: true,
      sort_order: 1,
    },
    person: {
      id: `person-${id}`,
      name: draft.personName.trim() || "Cup label",
      type: "guest",
      department: draft.group,
      usual_order: "",
      active: true,
      created_at: new Date(0).toISOString(),
    },
    order: {
      id: `order-${id}`,
      production_id: "draft-production",
      roster_id: `roster-${id}`,
      person_id: `person-${id}`,
      ...order,
      status: "confirmed",
      label_printed: false,
      created_at: new Date(0).toISOString(),
      updated_at: new Date(0).toISOString(),
    },
  };
}

function draftOrderPatch(draft: LabelDraft): Partial<Order> {
  return {
    size: draft.size.trim(),
    temperature: draft.temperature.trim(),
    drink_type: draft.drinkType.trim(),
    milk_type: draft.milkType.trim(),
    sweetener: draft.sweetener.trim(),
    caffeine: draft.caffeine.trim() || "Regular",
    special_notes: draft.specialNotes.trim(),
    vendor: "",
  };
}

function nextPrintableOrderId(items: RosterOrder[], currentId: string) {
  const printable = items.filter(isUnprintedPrintable);
  if (!printable.length) return "";

  const index = printable.findIndex((item) => item.order?.id === currentId);
  const next = printable[index + 1] || printable[0];
  return next.order?.id || "";
}
