import type { QuantityCandidate } from "./mapping-service.js";
import type { CategoryElementInfo } from "../types.js";

export function buildCountQuantityCandidates(
  category: string,
  elements: CategoryElementInfo[],
  unit = "pza"
): QuantityCandidate[] {
  const grouped = new Map<string, QuantityCandidate>();

  for (const element of elements) {
    const description = element.typeName || element.name;
    const levelName = element.level || "Unknown";
    const key = `${category}|${description}|${levelName}|${unit}`;
    const existing = grouped.get(key);

    if (existing) {
      existing.quantity += 1;
      existing.sourceElementIds.push(element.id);
      continue;
    }

    grouped.set(key, {
      sourceCategory: category,
      sourceElementIds: [element.id],
      description,
      unit,
      quantity: 1,
      levelName,
    });
  }

  return [...grouped.values()];
}
