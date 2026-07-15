export function parseProductionOrderPreference(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.every((id) => typeof id === "string")) {
      return [];
    }
    return Array.from(new Set(parsed.filter((id) => id.length > 0)));
  } catch {
    return [];
  }
}

export function reconcileProductionOrderPreference(
  preferredIds: string[],
  availableIds: string[],
): string[] {
  const available = new Set(availableIds);
  return Array.from(new Set(preferredIds.filter((id) => available.has(id))));
}
