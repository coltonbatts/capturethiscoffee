"use client";

import { useParams, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { useAppAuth } from "@/components/app-auth-provider";
import {
  EmptyState,
  Panel,
  RosterListSkeleton,
  secondaryButtonClass,
} from "@/components/ui";
import {
  addRosterPerson,
  createPersonAndAddToRoster,
  removeRosterRecord,
  saveOrderDraft,
  updateProductionRecord,
  updateRosterRecord,
} from "@/lib/data";
import { isOrderCaptured } from "@/lib/order-progress";
import { emptyPersonForm, type PersonForm } from "@/lib/people";
import { mintProductionShareLink } from "@/lib/share-links";
import type {
  Order,
  Production,
  ProductionRoster,
  RosterOrder,
} from "@/lib/types";
import {
  AddToRoster,
  ErrorToast,
  SearchRoster,
  OrderEditor,
  RosterList,
  ProductionDetailsEditor,
  QuickAddPersonSheet,
  RosterEditor,
  DayHeader,
  RunnerLinkSheet,
} from "./components";
import { useCoffeeStore } from "./use-coffee-store";
import { useRosterView } from "./use-roster-view";

export default function ProductionDashboardPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const shareToken = searchParams.get("token") || "";
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
  } = useCoffeeStore({ productionId: params.id, shareToken });

  // Filter state lives here so typing in search never re-renders the modals.
  const [query, setQuery] = useState("");
  const [needsOnly, setNeedsOnly] = useState(false);

  // Editor/sheet state.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<Order>>({});
  const [editorTitle, setEditorTitle] = useState("Edit order");
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
  const [copyLinkState, setCopyLinkState] = useState<"idle" | "working" | "copied">(
    "idle",
  );
  const [runnerLink, setRunnerLink] = useState<string | null>(null);

  const production = data?.productions.find((item) => item.id === params.id);
  const client = data?.clients.find((item) => item.id === production?.client_id);

  const filters = useMemo(() => ({ query, needsOnly }), [query, needsOnly]);
  const view = useRosterView(data, production, filters);

  if (!production) {
    return (
      <AppShell title="Day">
        {state === "loading" ? (
          <div className="grid gap-4">
            <Panel className="skeleton h-28 rounded-xl" />
            <RosterListSkeleton />
          </div>
        ) : state === "error" ? (
          <EmptyState
            title="Couldn't load this day"
            description={error}
            action={
              <button type="button" onClick={reload} className={secondaryButtonClass}>
                Try again
              </button>
            }
          />
        ) : (
          <EmptyState title="Day not found" />
        )}
      </AppShell>
    );
  }

  function takeOrder(order: Order) {
    setEditorTitle(isOrderCaptured(order) ? "Edit order" : "Take order");
    setEditingId(order.id);
    setDraft(order);
    setUpdateUsualOrder(false);
  }

  function markNoDrink(order: Order) {
    void patchOrder(order.id, { status: "no_order" });
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

  function copyRunnerLink() {
    if (copyLinkState === "working") return;
    setCopyLinkState("working");
    mintProductionShareLink(production!.id)
      .then((url) => {
        setCopyLinkState("idle");
        setRunnerLink(url);
      })
      .catch((err: unknown) => {
        setCopyLinkState("idle");
        setError(
          err instanceof Error ? err.message : "Could not create runner link.",
        );
      });
  }

  async function saveDraft() {
    if (!editingId) return;
    const id = editingId;
    // Saving the editor always captures the drink. Legacy pipeline statuses
    // on old rows are preserved; needs-order and no-drink become captured.
    const status =
      draft.status && draft.status !== "not_asked" && draft.status !== "no_order"
        ? draft.status
        : "confirmed";
    const ok = await run(
      (base) =>
        saveOrderDraft(
          base,
          id,
          { ...draft, status },
          {
            updateUsualOrder: isAdmin && updateUsualOrder,
            productionId: production!.id,
            shareToken,
          },
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

  const detail = [client?.name, production.shoot_date, production.location]
    .filter(Boolean)
    .join(" · ");

  return (
    <AppShell title={production.name}>
      <div className="mx-auto w-full max-w-md px-1 sm:max-w-xl sm:px-0 md:max-w-3xl">
        <DayHeader
          detail={detail}
          runnerName={production.runner_name}
          progress={view.progress}
          printHref={
            isAdmin
              ? `/labels?production=${encodeURIComponent(production.id)}`
              : undefined
          }
          onEditDetails={isAdmin ? openProductionEditor : undefined}
          onCopyRunnerLink={
            isAdmin && production.status !== "complete" ? copyRunnerLink : undefined
          }
          copyLinkState={copyLinkState}
        />

        <SearchRoster
          query={query}
          onQuery={setQuery}
          needsOnly={needsOnly}
          onNeedsOnly={setNeedsOnly}
          neededCount={view.progress.needed}
          count={view.filteredItems.length}
          total={view.progress.total}
        />

        <RosterList
          items={view.filteredItems}
          pendingOrders={pendingOrders}
          canManageSetup={isAdmin}
          onTakeOrder={takeOrder}
          onNoDrink={markNoDrink}
          onEditRoster={openRosterEditor}
        />

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
            title={editorTitle}
            draft={draft}
            updateUsualOrder={updateUsualOrder}
            canUpdateUsualOrder={isAdmin}
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

        {runnerLink && isAdmin ? (
          <RunnerLinkSheet url={runnerLink} onClose={() => setRunnerLink(null)} />
        ) : null}

        {error ? <ErrorToast message={error} onDismiss={() => setError("")} /> : null}
      </div>
    </AppShell>
  );
}
