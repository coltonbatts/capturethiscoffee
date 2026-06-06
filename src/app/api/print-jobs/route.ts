import { ApiError, jsonError, parsePositiveInteger, requireAuthenticatedBearerToken } from "@/lib/supabase-server";
import {
  isLabelPrintJobPayloadV1,
  type LabelPrintJobPayloadV1,
  type LabelPrintJobStatus,
} from "@/lib/print-jobs";

type IncomingPrintJob = {
  production_id?: unknown;
  order_id?: unknown;
  person_id?: unknown;
  priority?: unknown;
  payload?: LabelPrintJobPayloadV1;
  copies?: unknown;
};

export async function GET(request: Request) {
  try {
    const { supabase } = await requireAuthenticatedBearerToken(request);
    const url = new URL(request.url);
    const status = url.searchParams.get("status") as LabelPrintJobStatus | null;
    const productionId = url.searchParams.get("production_id");
    const limit = parsePositiveInteger(url.searchParams.get("limit"), 50, 100);

    let query = supabase
      .from("label_print_jobs")
      .select("*, label_print_attempts(*)")
      .order("priority", { ascending: false })
      .order("created_at", { ascending: true })
      .limit(limit);

    if (status) query = query.eq("status", status);
    if (productionId) query = query.eq("production_id", productionId);

    const { data, error } = await query;
    if (error) throw new ApiError(error.message, 400);

    return Response.json({ jobs: data || [] });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { supabase, user } = await requireAuthenticatedBearerToken(request);
    const body = (await request.json()) as IncomingPrintJob & {
      jobs?: IncomingPrintJob[];
    };
    const jobs = Array.isArray(body.jobs) ? body.jobs : [body];

    const inserts = jobs.map((job) => {
      if (!isLabelPrintJobPayloadV1(job.payload)) {
        throw new ApiError("Invalid label print job payload.", 400);
      }
      const priority =
        typeof job.priority === "number" && Number.isInteger(job.priority)
          ? job.priority
          : 0;

      return {
        production_id: stringOrNull(job.production_id),
        order_id: stringOrNull(job.order_id),
        person_id: stringOrNull(job.person_id),
        created_by: user.id,
        priority,
        payload: job.payload,
        printer_family: job.payload.printer_family,
        copies: parsePositiveInteger(job.copies, 1, 20),
      };
    });

    const { data, error } = await supabase
      .from("label_print_jobs")
      .insert(inserts)
      .select("*");

    if (error) throw new ApiError(error.message, 400);

    return Response.json({ jobs: data || [] }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}

function stringOrNull(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
