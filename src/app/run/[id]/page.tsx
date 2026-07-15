import { notFound } from "next/navigation";
import {
  ShareTokenError,
  validateProductionShareToken,
} from "@/lib/production-share";
import { getSupabaseServiceRoleClient } from "@/lib/supabase-server";
import {
  getProductionBoard,
  ProductionQueryError,
} from "@/server/productions/queries";
import type { ProductionBoardDTO } from "@/server/productions/dto";
import { RunnerBoard } from "./runner-board";

export const dynamic = "force-dynamic";

export default async function RunProductionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const tokenValue = query.token;
  const token = Array.isArray(tokenValue) ? tokenValue[0] || "" : tokenValue || "";

  let board: ProductionBoardDTO;
  try {
    const supabase = getSupabaseServiceRoleClient();
    await validateProductionShareToken(supabase, id, token);
    board = await getProductionBoard(supabase, id);
  } catch (error) {
    if (
      error instanceof ShareTokenError ||
      (error instanceof ProductionQueryError && error.status === 404)
    ) {
      notFound();
    }
    throw error;
  }

  return (
    <RunnerBoard
      key={`${id}:${token}`}
      initialBoard={board}
      token={token}
    />
  );
}
