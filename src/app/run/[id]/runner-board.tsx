"use client";

import { useMemo, useState } from "react";
import { CaptureMark } from "@/components/capture-mark";
import { isOrderCaptured } from "@/lib/order-progress";
import {
  captureProductionBoardProgress,
  filterProductionBoardRoster,
  type ProductionBoardDTO,
  type ProductionBoardOrderDTO,
} from "@/lib/production-board";
import {
  DayHeader,
  ErrorToast,
  OrderEditor,
  RosterList,
  SearchRoster,
} from "@/app/productions/[id]/components";
import { useRunnerBoard, type RunnerOrderPatch } from "./use-runner-board";

export function RunnerBoard({
  initialBoard,
  token,
}: {
  initialBoard: ProductionBoardDTO;
  token: string;
}) {
  const { board, error, setError, pendingOrders, patchOrder } = useRunnerBoard({
    initialBoard,
    token,
  });
  const [query, setQuery] = useState("");
  const [needsOnly, setNeedsOnly] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<ProductionBoardOrderDTO>>({});

  const progress = useMemo(
    () => captureProductionBoardProgress(board.roster),
    [board.roster],
  );
  const filteredItems = useMemo(
    () => filterProductionBoardRoster(board.roster, { query, needsOnly }),
    [board.roster, needsOnly, query],
  );
  const production = board.production;
  const detail = [
    production.client_name,
    production.shoot_date,
    production.location,
  ]
    .filter(Boolean)
    .join(" · ");

  function takeOrder(order: ProductionBoardOrderDTO) {
    setEditingId(order.id);
    setDraft(order);
  }

  function closeEditor() {
    setEditingId(null);
    setDraft({});
  }

  async function saveDraft() {
    if (!editingId) return;
    const status =
      draft.status && draft.status !== "not_asked" && draft.status !== "no_order"
        ? draft.status
        : "confirmed";
    const patch: RunnerOrderPatch = {
      drink_type: draft.drink_type || "",
      size: draft.size || "",
      temperature: draft.temperature || "",
      milk_type: draft.milk_type || "",
      sweetener: draft.sweetener || "",
      caffeine: draft.caffeine || "",
      special_notes: draft.special_notes || "",
      vendor: draft.vendor || "",
      status,
    };

    if (await patchOrder(editingId, patch)) closeEditor();
  }

  return (
    <div className="min-h-dvh bg-white text-black">
      <header className="sticky top-0 z-30 border-b border-black bg-white">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-2.5 sm:px-6">
          <CaptureMark className="size-9 rounded-lg" priority />
          <span className="truncate text-lg font-black">{production.name}</span>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl px-4 py-5 sm:px-6 md:py-7">
        <DayHeader
          productionName={production.name}
          detail={detail}
          runnerName={production.runner_name}
          progress={progress}
        />
        <SearchRoster
          query={query}
          onQuery={setQuery}
          needsOnly={needsOnly}
          onNeedsOnly={setNeedsOnly}
          neededCount={progress.needed}
          count={filteredItems.length}
          total={progress.total}
        />
        <RosterList
          items={filteredItems}
          pendingOrders={pendingOrders}
          canManageSetup={false}
          onTakeOrder={takeOrder}
          onNoDrink={(order) => void patchOrder(order.id, { status: "no_order" })}
          onEditRoster={() => {}}
        />

        {editingId ? (
          <OrderEditor
            title={
              isOrderCaptured(draft as ProductionBoardOrderDTO)
                ? "Edit order"
                : "Take order"
            }
            draft={draft}
            updateUsualOrder={false}
            canUpdateUsualOrder={false}
            onChange={setDraft}
            onUpdateUsualOrder={() => {}}
            onCancel={closeEditor}
            onSave={saveDraft}
            saving={pendingOrders.has(editingId)}
          />
        ) : null}

        {error ? <ErrorToast message={error} onDismiss={() => setError("")} /> : null}
      </main>
    </div>
  );
}
