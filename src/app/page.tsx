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
import { useEffect, useMemo, useState } from "react";
import { CaptureAngle } from "@/components/capture-mark";
import { AppShell } from "@/components/app-shell";
import {
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

export default function LabelWorkstationPage() {
  const [data, setData] = useState<CoffeeData | null>(null);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState("manual");
  const [draft, setDraft] = useState<LabelDraft>(blankDraft);
  const [style, setStyle] = useState<LabelContentStyle>("standard");
  const [fields, setFields] = useState<LabelFieldOptions>(defaultLabelFields);
  const [printing, setPrinting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [printerProbe, setPrinterProbe] = useState("");
  const [checkingPrinter, setCheckingPrinter] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  const [printLabels, setPrintLabels] = useState<CoffeeLabel[]>([]);

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

  function updateDraft(patch: Partial<LabelDraft>) {
    setDraft((current) => ({ ...current, ...patch }));
  }

  function chooseOrder(orderId: string) {
    setSelectedId(orderId);

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
    const client = data?.clients.find((entry) => entry.id === production?.client_id);
    setDraft({
      personName: item.person.name,
      group: item.roster.group_label || item.person.department || "Set",
      productionName: production?.name || "Today on set",
      clientName: client?.name || "",
      size: item.order.size || "",
      temperature: item.order.temperature || "",
      drinkType: item.order.drink_type || "",
      milkType: item.order.milk_type || "",
      sweetener: item.order.sweetener || "",
      caffeine: item.order.caffeine || "Regular",
      specialNotes: item.order.special_notes || "",
    });
  }

  async function printCurrent({ advance }: { advance: boolean }) {
    if (!currentLabel || !draft.personName.trim()) {
      setError("Enter a name before printing.");
      return;
    }

    setPrinting(true);
    setError("");

    try {
      if (data && selectedItem?.order) {
        const next = await updateOrderRecord(data, selectedItem.order.id, {
          ...draftOrderPatch(draft),
          status: selectedItem.order.status === "not_asked" ? "confirmed" : selectedItem.order.status,
          label_printed: true,
        });
        setData(next);
      }

      setPrintLabels([currentLabel]);
      setRecent((current) => [
        `${currentLabel.personName} - ${currentLabel.drink}`,
        ...current.filter((item) => item !== `${currentLabel.personName} - ${currentLabel.drink}`),
      ].slice(0, 5));

      window.setTimeout(() => window.print(), 60);

      if (advance) {
        const next = nextPrintableOrderId(rosterItems, selectedId);
        if (next) chooseOrder(next);
        else chooseOrder("manual");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not prepare that label.");
    } finally {
      window.setTimeout(() => setPrinting(false), 300);
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
    const firstOrder = first
      ? rosterOrdersForProduction(next, first.id).find((item) => item.order)?.order?.id
      : undefined;
    chooseOrder("manual");
    if (firstOrder) window.setTimeout(() => chooseOrder(firstOrder), 0);
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
              Coffee labels
            </h1>
            <p className="mt-1 text-sm font-medium text-zinc-600">
              Create, preview, and print.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 rounded-xl border border-zinc-200 bg-zinc-50 p-2 text-center">
            <Metric value={rosterItems.length || 0} label="Loaded" />
            <Metric
              value={rosterItems.filter((item) => item.order?.label_printed).length}
              label="Printed"
            />
            <Metric
              value={rosterItems.filter((item) => item.order?.status !== "no_order").length || 1}
              label="Ready"
            />
          </div>
        </section>

        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-800">
            {error}
          </div>
        ) : null}

        <div className="grid gap-4 xl:grid-cols-[minmax(320px,0.9fr)_minmax(360px,1.1fr)_minmax(280px,0.75fr)]">
          <Panel className="grid gap-4 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="flex items-center gap-2 text-lg font-bold">
                  <UserRound size={19} aria-hidden="true" />
                  Details
                </h2>
                <p className="mt-1 text-sm text-zinc-600">
                  Pick someone from the shoot or type a one-off label.
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
                {rosterItems.map((item) =>
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

            <div className="grid min-h-[320px] place-items-center rounded-2xl border border-zinc-200 bg-[linear-gradient(135deg,#f8fafc_0%,#f8fafc_48%,#eef2f7_48%,#eef2f7_52%,#f8fafc_52%)] p-4">
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
                className={`${secondaryButtonClass} min-h-14`}
              >
                <Clipboard size={18} aria-hidden="true" />
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
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
              <button
                type="button"
                onClick={checkPrinter}
                className={secondaryButtonClass}
                disabled={checkingPrinter}
              >
                <Printer size={18} aria-hidden="true" />
                {checkingPrinter ? "Checking..." : "Check NIIMBOT M2"}
              </button>
              {printerProbe ? (
                <p className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm font-medium leading-6 text-zinc-700">
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
                Shoots
              </Link>
              <Link href="/people" className={secondaryButtonClass}>
                <UserRound size={18} aria-hidden="true" />
                People
              </Link>
              <Link href="/productions/new" className={secondaryButtonClass}>
                <BadgePlus size={18} aria-hidden="true" />
                New shoot
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
        <div className="m2-label-sheet">
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

function Metric({ value, label }: { value: number; label: string }) {
  return (
    <div className="min-w-20 rounded-lg bg-white px-3 py-2 ring-1 ring-zinc-200">
      <p className="text-2xl font-black leading-none">{value}</p>
      <p className="mt-1 text-xs font-semibold text-zinc-500">{label}</p>
    </div>
  );
}

function ScreenLabel({ label }: { label: CoffeeLabel }) {
  return (
    <div className="grid aspect-[5/3] w-full max-w-[500px] grid-cols-[72px_1fr] grid-rows-[auto_1fr_auto] gap-x-4 overflow-hidden border-[3px] border-black bg-white p-5 font-sans text-black shadow-xl shadow-black/15">
      <div className="row-span-2 grid size-16 place-items-center border-[3px] border-black p-2">
        <CaptureAngle />
      </div>
      <h3 className="truncate text-3xl font-black leading-none">
        {label.title || label.personName}
      </h3>
      <p className="mt-2 overflow-hidden text-xl font-black leading-tight">
        {label.bodyLines.join(" / ") || label.drink}
      </p>
      <div className="col-span-2 flex items-end justify-between gap-3 border-t-2 border-black pt-3 text-sm font-black leading-none">
        <span className="min-w-0 truncate">{label.footerStart}</span>
        <span className="min-w-0 truncate">{label.footerEnd}</span>
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
  const printable = items.filter(
    (item) => item.order && item.order.status !== "no_order",
  );
  if (!printable.length) return "";

  const index = printable.findIndex((item) => item.order?.id === currentId);
  const next = printable[index + 1] || printable[0];
  return next.order?.id || "";
}
