import { ApiError, jsonError, requireStaffBearerToken } from "@/lib/supabase-server";
import type { LabelPrintAttemptStatus, LabelPrintTransport } from "@/lib/print-jobs";

const attemptStatuses: LabelPrintAttemptStatus[] = [
  "started",
  "succeeded",
  "failed",
  "cancelled",
];

const transports: LabelPrintTransport[] = [
  "ios_ble",
  "laptop_browser",
  "laptop_usb",
  "bridge",
];

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { supabase, user } = await requireStaffBearerToken(request);
    const { id } = await context.params;
    const body = await request.json();
    const status = body.status as LabelPrintAttemptStatus;
    const transport = body.transport as LabelPrintTransport;

    if (!attemptStatuses.includes(status)) {
      throw new ApiError("Invalid attempt status.", 400);
    }

    if (!transports.includes(transport)) {
      throw new ApiError("Invalid print transport.", 400);
    }

    const { data, error } = await supabase
      .from("label_print_attempts")
      .insert({
        job_id: id,
        staff_user_id: user.id,
        device_id: stringOrNull(body.device_id),
        status,
        transport,
        printer_name: stringOrNull(body.printer_name),
        printer_identifier: stringOrNull(body.printer_identifier),
        sdk_version: stringOrNull(body.sdk_version),
        error_code: stringOrNull(body.error_code),
        error_message: stringOrNull(body.error_message),
        finished_at: status === "started" ? null : new Date().toISOString(),
      })
      .select("*")
      .single();

    if (error) throw new ApiError(error.message, 400);

    return Response.json({ attempt: data }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}

function stringOrNull(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
