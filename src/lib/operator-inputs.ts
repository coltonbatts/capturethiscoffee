import type { Order, PersonType, Production } from "./types";

export type NewClientInput = {
  name: string;
  notes?: string;
};

export type NewPersonInput = {
  name: string;
  type: PersonType;
  role?: string;
  department?: string;
  company?: string;
  photo_url?: string;
  usual_order?: string;
  dietary_notes?: string;
  notes?: string;
  active?: boolean;
};

export type UpdatePersonInput = NewPersonInput;

export type NewProductionInput = {
  name: string;
  client_id: string;
  new_client_name?: string;
  shoot_date?: string;
  location?: string;
  runner_name?: string;
  notes?: string;
};

export type UpdateProductionInput = {
  name?: string;
  client_id?: string;
  new_client_name?: string;
  shoot_date?: string;
  location?: string;
  runner_name?: string;
  notes?: string;
  status?: Production["status"];
};

export type UpdateRosterInput = {
  group_label?: string;
  on_set_today?: boolean;
};

export type CreatePersonAndRosterOptions = {
  linkToClientId?: string;
};

export type SaveOrderOptions = {
  updateUsualOrder?: boolean;
};

export type OperatorActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export type OrderPatch = Partial<
  Pick<
    Order,
    | "drink_type"
    | "size"
    | "temperature"
    | "milk_type"
    | "sweetener"
    | "caffeine"
    | "special_notes"
    | "vendor"
    | "status"
    | "label_printed"
  >
>;

export function unwrapOperatorAction<T>(result: OperatorActionResult<T>): T {
  if (!result.ok) throw new Error(result.error);
  return result.data;
}
