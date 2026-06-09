"use client";

import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { useAppAuth } from "@/components/app-auth-provider";
import { EmptyState, Panel, secondaryButtonClass } from "@/components/ui";
import { plainTextCoffeeSummary } from "@/lib/order-summary";
import {
  addRosterPerson,
  createPersonAndAddToRoster,
  removeRosterRecord,
  saveOrderDraft,
  updateProductionRecord,
  updateRosterRecord,
} from "@/lib/data";
import { emptyPersonForm, type PersonForm } from "@/lib/people";
import type {
  Order,
  OrderStatus,
  Production,
  ProductionRoster,
  RosterOrder,
} from "@/lib/types";
import {
  AddToRoster,
  DrinksTab,
  ErrorToast,
  FilterBar,
  GroupsTab,
  LabelsTab,
  OrderEditor,
  PeopleTab,
  ProductionDetailsEditor,
  QuickAddPersonSheet,
  RosterEditor,
  RunMetrics,
  RunnerHeader,
  StatusTab,
  SummaryTab,
  type Tab,
} from "./components";
import { useCoffeeStore } from "./use-coffee-store";
import { type RosterStateFilter, useRosterView } from "./use-roster-view";

export default function ProductionDashboardPage() {
  const params = useParams<{ id: string }>();
  const { isAdmin } = useAppAuth();
  const {
    data,
    state,
    error,
    setError,
    saving,
    pendingOrders,
    patchOrder,
    run,
    reload,
  } = useCoffeeStore();

  // Filter state lives here so typing in search never re-renders the modals.
  const [query, setQuery] = useState("");
  const [groupFilter, setGroupFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "all">("all");
  const [rosterStateFilter, setRosterStateFilter] =
    useState<RosterStateFilter>("on_set");
  const [tab, setTab] = useState<Tab>("People");

  // Editor/sheet state.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<Order>>({});
  const [updateUsualOrder, setUpdateUsualOrder] = useState(false);
  const [editingRosterId, setEditingRosterId] = useState<string | null>(null);
  const [rosterDraft, setRosterDraft] = useState<Partial<ProductionRoster>>({});
  const [editingProduction, setEditingProduction] = useState(false);
  const [productionDraft, setProductionDraft] = useState<
    Pick<Production, "name" | "shoot_date" | "location" | "runner_name" | "notes">
  >({
    name: "",
    shoot_date: "",
    location: "",
    runner_name: "",
    notes: "",
  });
  const [personToAdd, setPersonToAdd] = useState("");
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickAddForm, setQuickAddForm] = useState<PersonForm>(() =>
    emptyPersonForm("guest"),
  );
  const [linkQuickAddToClient, setLinkQuickAddToClient] = useState(false);
  const [copied, setCopied] = useState(false);

  const production = data?.productions.find((item) => item.id === params.id);
  const client = data?.clients.find((item) => item.id === production?.client_id);

  const filters = useMemo(
    () => ({ query, groupFilter, statusFilter, rosterStateFilter }),
    [query, groupFilter, statusFilter, rosterStateFilter],
  );
  const view = useRosterView(data, production, filters);

  if (!production) {
    return (
      <AppShell title="Production">
        {state === "loading" ? (
          <Panel className="h-40 animate-pulse bg-white/70 p-4" />
        ) : state === "error" ? (
          <EmptyState
            title="Couldn't load this production"
            description={error}
            action={
              <button type="button" onClick={reload} className={secondaryButtonClass}>
                Try again
              </button>
            }
          />
        ) : (
          <EmptyState title="Production not found" />
        )}
      </AppShell>
    );
  }

  function advance(order: Order, status: OrderStatus) {
    void patchOrder(order.id, { status });
  }

  function openOrderEditor(order: Order) {
    setEditingId(order.id);
    setDraft(order);
    setUpdateUsualOrder(false);
  }

  function openRosterEditor(item: RosterOrder) {
    setEditingRosterId(item.roster.id);
    setRosterDraft(item.roster);
  }

  function closeOrderEditor() {
    setEditingId(null);
    setDraft({});
    setUpdateUsualOrder(false);
  }

  function closeRosterEditor() {
    setEditingRosterId(null);
    setRosterDraft({});
  }

  function openProductionEditor() {
    setProductionDraft({
      name: production!.name,
      shoot_date: production!.shoot_date,
      location: production!.location,
      runner_name: production!.runner_name,
      notes: production!.notes,
    });
    setEditingProduction(true);
  }

  function closeProductionEditor() {
    setEditingProduction(false);
  }

  async function saveDraft() {
    if (!editingId) return;
    const id = editingId;
    const ok = await run(
      (base) =>
        saveOrderDraft(
          base,
          id,
          { ...draft, status: (draft.status || "confirmed") as OrderStatus },
          { updateUsualOrder },
        ),
      "Could not save order.",
    );
    if (ok) closeOrderEditor();
  }

  async function addPerson() {
    if (!personToAdd) return;
    const ok = await run(
      (base) => addRosterPerson(base, production!.id, personToAdd),
      "Could not add roster member.",
    );
    if (ok) setPersonToAdd("");
  }

  async function saveRoster() {
    if (!editingRosterId) return;
    const id = editingRosterId;
    const ok = await run(
      (base) =>
        updateRosterRecord(base, production!.id, id, {
          group_label: rosterDraft.group_label || "",
          on_set_today: rosterDraft.on_set_today ?? true,
        }),
      "Could not update roster.",
    );
    if (ok) closeRosterEditor();
  }

  async function saveProductionDetails() {
    const ok = await run(
      (base) => updateProductionRecord(base, production!.id, productionDraft),
      "Could not update production.",
    );
    if (ok) closeProductionEditor();
  }

  async function removeRoster() {
    if (!editingRosterId) return;
    const id = editingRosterId;
    const ok = await run(
      (base) => removeRosterRecord(base, production!.id, id),
      "Could not remove roster member.",
    );
    if (ok) closeRosterEditor();
  }

  async function quickAddPerson(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!quickAddForm.name.trim()) return;
    const ok = await run(
      (base) =>
        createPersonAndAddToRoster(base, production!.id, quickAddForm, {
          linkToClientId: linkQuickAddToClient ? production!.client_id : undefined,
        }),
      "Could not quick add person.",
    );
    if (ok) {
      setQuickAddForm(emptyPersonForm("guest"));
      setLinkQuickAddToClient(false);
      setQuickAddOpen(false);
    }
  }

  async function copySummary() {
    const text = plainTextCoffeeSummary(production!, client, view.activeItems);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      setError("Couldn't copy automatically — select the summary text to copy it.");
    }
  }

  const detail = [client?.name, production.shoot_date, production.location]
    .filter(Boolean)
    .join(" · ");

  return (
    <AppShell title={production.name}>
      <RunnerHeader
        detail={detail}
        runnerName={production.runner_name}
        progress={view.progress}
        onEditDetails={isAdmin ? openProductionEditor : undefined}
      />

      <RunMetrics
        total={view.progress.total}
        delivered={view.progress.delivered}
        offSet={view.offSetCount}
      />

      <FilterBar
        query={query}
        onQuery={setQuery}
        rosterStateFilter={rosterStateFilter}
        onRosterState={setRosterStateFilter}
        groupFilter={groupFilter}
        onGroup={setGroupFilter}
        statusFilter={statusFilter}
        onStatus={setStatusFilter}
        groups={view.groups}
        tab={tab}
        onTab={setTab}
      />

      {tab === "People" ? (
        <PeopleTab
          items={view.filteredItems}
          pendingOrders={pendingOrders}
          canManageSetup={isAdmin}
          onAdvance={advance}
          onEdit={openOrderEditor}
          onEditRoster={openRosterEditor}
          onNoOrder={(order) => advance(order, "no_order")}
          onDelivered={(order) => advance(order, "delivered")}
        />
      ) : null}
      {tab === "Groups" ? <GroupsTab items={view.activeItems} /> : null}
      {tab === "Drinks" ? <DrinksTab items={view.activeItems} /> : null}
      {tab === "Status" ? (
        <StatusTab
          items={view.activeItems}
          pendingOrders={pendingOrders}
          onStatus={(orderId, patch) => void patchOrder(orderId, patch)}
        />
      ) : null}
      {tab === "Summary" ? (
        <SummaryTab
          productionName={production.name}
          clientName={client?.name || ""}
          summary={plainTextCoffeeSummary(production, client, view.activeItems)}
          items={view.activeItems}
          copied={copied}
          onCopy={copySummary}
        />
      ) : null}
      {tab === "Labels" ? (
        <LabelsTab
          productionName={production.name}
          clientName={client?.name || ""}
          items={view.activeItems}
          onCopyError={setError}
        />
      ) : null}

      {isAdmin ? (
        <AddToRoster
          people={view.peopleNotOnRoster.map((person) => ({
            id: person.id,
            label: `${person.name} - ${person.department || person.type}`,
          }))}
          value={personToAdd}
          onChange={setPersonToAdd}
          onAdd={addPerson}
          onNewGuest={() => {
            setQuickAddForm(emptyPersonForm("guest"));
            setLinkQuickAddToClient(false);
            setQuickAddOpen(true);
          }}
          saving={saving}
        />
      ) : null}

      {editingId ? (
        <OrderEditor
          draft={draft}
          updateUsualOrder={updateUsualOrder}
          onChange={setDraft}
          onUpdateUsualOrder={setUpdateUsualOrder}
          onCancel={closeOrderEditor}
          onSave={saveDraft}
          saving={saving}
        />
      ) : null}

      {editingRosterId && isAdmin ? (
        <RosterEditor
          draft={rosterDraft}
          onChange={setRosterDraft}
          onCancel={closeRosterEditor}
          onRemove={removeRoster}
          onSave={saveRoster}
          saving={saving}
        />
      ) : null}

      {editingProduction && isAdmin ? (
        <ProductionDetailsEditor
          draft={productionDraft}
          onChange={setProductionDraft}
          onCancel={closeProductionEditor}
          onSave={saveProductionDetails}
          saving={saving}
        />
      ) : null}

      {quickAddOpen && isAdmin ? (
        <QuickAddPersonSheet
          form={quickAddForm}
          clientName={client?.name || "this client"}
          linkToClient={linkQuickAddToClient}
          onChange={setQuickAddForm}
          onLinkToClientChange={setLinkQuickAddToClient}
          onCancel={() => {
            setQuickAddOpen(false);
            setQuickAddForm(emptyPersonForm("guest"));
            setLinkQuickAddToClient(false);
          }}
          onSubmit={quickAddPerson}
          saving={saving}
        />
      ) : null}

      {error ? <ErrorToast message={error} onDismiss={() => setError("")} /> : null}
    </AppShell>
  );
}
