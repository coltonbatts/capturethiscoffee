"use server";

import "server-only";

import { revalidatePath } from "next/cache";
import type {
  CreatePersonAndRosterOptions,
  NewClientInput,
  NewPersonInput,
  NewProductionInput,
  OperatorActionResult,
  OrderPatch,
  SaveOrderOptions,
  UpdatePersonInput,
  UpdateProductionInput,
  UpdateRosterInput,
} from "@/lib/operator-inputs";
import type {
  Client,
  ClientPerson,
  Order,
  Person,
  Production,
  ProductionRoster,
} from "@/lib/types";
import {
  createClient,
  linkPersonToClient,
  unlinkPersonFromClient,
  updateClient,
} from "@/server/operator/clients";
import { sanitizedOperatorError } from "@/server/operator/errors";
import { saveOrderDraft, updateOrder } from "@/server/operator/orders";
import { createPerson, updatePerson } from "@/server/operator/people";
import {
  createProduction,
  deleteProduction,
  mintProductionShareToken,
  updateProduction,
} from "@/server/operator/productions";
import {
  addRosterPerson,
  createPersonAndAddToRoster,
  removeRoster,
  updateRoster,
} from "@/server/operator/roster";

async function actionResult<T>(
  operation: () => Promise<T>,
  fallback: string,
): Promise<OperatorActionResult<T>> {
  try {
    return { ok: true, data: await operation() };
  } catch (error) {
    return { ok: false, error: sanitizedOperatorError(error, fallback) };
  }
}

export async function createClientAction(
  input: NewClientInput,
): Promise<OperatorActionResult<Client>> {
  return actionResult(async () => {
    const result = await createClient(input);
    revalidatePath("/productions");
    return result;
  }, "Could not create client.");
}

export async function updateClientAction(
  clientId: string,
  input: NewClientInput & { active?: boolean },
): Promise<OperatorActionResult<Client>> {
  return actionResult(async () => {
    const result = await updateClient(clientId, input);
    revalidatePath("/productions");
    revalidatePath("/labels");
    return result;
  }, "Could not update client.");
}

export async function createPersonAction(
  input: NewPersonInput,
): Promise<OperatorActionResult<Person>> {
  return actionResult(async () => {
    const result = await createPerson(input);
    revalidatePath("/people");
    return result;
  }, "Could not add person.");
}

export async function updatePersonAction(
  personId: string,
  input: UpdatePersonInput,
): Promise<OperatorActionResult<Person>> {
  return actionResult(async () => {
    const result = await updatePerson(personId, input);
    revalidatePath("/people");
    revalidatePath("/productions");
    revalidatePath("/labels");
    return result;
  }, "Could not update person.");
}

export async function createProductionAction(
  input: NewProductionInput,
): Promise<OperatorActionResult<{ productionId: string }>> {
  return actionResult(async () => {
    const result = await createProduction(input);
    revalidatePath("/productions");
    return { productionId: result.id };
  }, "Could not create the day.");
}

export async function updateProductionAction(
  productionId: string,
  input: UpdateProductionInput,
): Promise<OperatorActionResult<Production>> {
  return actionResult(async () => {
    const result = await updateProduction(productionId, input);
    revalidatePath("/productions");
    revalidatePath(`/productions/${result.id}`);
    revalidatePath("/labels");
    return result;
  }, "Could not update production.");
}

export async function deleteProductionAction(
  productionId: string,
): Promise<OperatorActionResult<{ id: string }>> {
  return actionResult(async () => {
    const result = await deleteProduction(productionId);
    revalidatePath("/productions");
    revalidatePath("/labels");
    return result;
  }, "Could not delete day.");
}

export async function addRosterPersonAction(
  productionId: string,
  personId: string,
): Promise<OperatorActionResult<{ roster: ProductionRoster; order: Order }>> {
  return actionResult(async () => {
    const result = await addRosterPerson(productionId, personId);
    revalidatePath(`/productions/${productionId}`);
    revalidatePath("/labels");
    return result;
  }, "Could not add roster member.");
}

export async function createPersonAndAddToRosterAction(
  productionId: string,
  input: NewPersonInput,
  options: CreatePersonAndRosterOptions = {},
): Promise<
  OperatorActionResult<{ person: Person; roster: ProductionRoster; order: Order }>
> {
  return actionResult(async () => {
    const result = await createPersonAndAddToRoster(productionId, input, options);
    revalidatePath(`/productions/${productionId}`);
    revalidatePath("/people");
    revalidatePath("/labels");
    return result;
  }, "Could not quick add person.");
}

export async function updateRosterAction(
  productionId: string,
  rosterId: string,
  input: UpdateRosterInput,
): Promise<OperatorActionResult<ProductionRoster>> {
  return actionResult(async () => {
    const result = await updateRoster(productionId, rosterId, input);
    revalidatePath(`/productions/${productionId}`);
    revalidatePath("/labels");
    return result;
  }, "Could not update roster.");
}

export async function removeRosterAction(
  productionId: string,
  rosterId: string,
): Promise<OperatorActionResult<{ id: string }>> {
  return actionResult(async () => {
    const result = await removeRoster(productionId, rosterId);
    revalidatePath(`/productions/${productionId}`);
    revalidatePath("/labels");
    return result;
  }, "Could not remove roster member.");
}

export async function updateOrderAction(
  orderId: string,
  patch: OrderPatch,
): Promise<OperatorActionResult<Order>> {
  return actionResult(async () => {
    const result = await updateOrder(orderId, patch);
    revalidatePath(`/productions/${result.production_id}`);
    revalidatePath("/labels");
    return result;
  }, "Could not update order.");
}

export async function saveOrderDraftAction(
  orderId: string,
  patch: OrderPatch,
  options: SaveOrderOptions = {},
): Promise<
  OperatorActionResult<{
    order: Order;
    usualOrderPersonId?: string;
    usualOrder?: string;
  }>
> {
  return actionResult(async () => {
    const result = await saveOrderDraft(orderId, patch, options);
    revalidatePath(`/productions/${result.order.production_id}`);
    revalidatePath("/people");
    revalidatePath("/labels");
    return result;
  }, "Could not save order.");
}

export async function linkPersonToClientAction(
  clientId: string,
  personId: string,
  relationshipNotes?: string,
): Promise<OperatorActionResult<ClientPerson>> {
  return actionResult(async () => {
    const result = await linkPersonToClient(clientId, personId, relationshipNotes);
    revalidatePath("/productions");
    return result;
  }, "Could not link person.");
}

export async function unlinkPersonFromClientAction(
  clientId: string,
  personId: string,
): Promise<OperatorActionResult<{ clientId: string; personId: string }>> {
  return actionResult(async () => {
    const result = await unlinkPersonFromClient(clientId, personId);
    revalidatePath("/productions");
    return result;
  }, "Could not unlink person.");
}

export async function mintProductionShareTokenAction(
  productionId: string,
  label?: string,
): Promise<OperatorActionResult<{ productionId: string; token: string }>> {
  return actionResult(
    () => mintProductionShareToken(productionId, label),
    "Could not create share link.",
  );
}
