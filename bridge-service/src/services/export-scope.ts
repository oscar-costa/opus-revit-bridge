import type { SupportedExportCategory, ValidationSummary } from "../types.js";

export const DEFAULT_EXPORT_CATEGORIES: SupportedExportCategory[] = [
  "walls",
  "rooms",
  "doors",
  "windows",
];

export function normalizeExportCategories(
  categories?: SupportedExportCategory[]
): SupportedExportCategory[] {
  if (!categories || categories.length === 0) {
    return [...DEFAULT_EXPORT_CATEGORIES];
  }

  return [...new Set(categories)];
}

export function mergeValidationSummaries(
  summaries: ValidationSummary[]
): ValidationSummary {
  return summaries.reduce<ValidationSummary>(
    (merged, summary) => ({
      totalLines: merged.totalLines + summary.totalLines,
      unmappedLines: merged.unmappedLines + summary.unmappedLines,
      totalQuantity: merged.totalQuantity + summary.totalQuantity,
      issues: [...merged.issues, ...summary.issues],
    }),
    {
      totalLines: 0,
      unmappedLines: 0,
      totalQuantity: 0,
      issues: [],
    }
  );
}

export function formatExportScope(categories: SupportedExportCategory[]): string {
  return categories
    .map((category) => category.charAt(0).toUpperCase() + category.slice(1))
    .join(", ");
}
