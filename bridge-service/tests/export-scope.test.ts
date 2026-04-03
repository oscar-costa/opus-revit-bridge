import { describe, expect, it } from "vitest";
import {
  DEFAULT_EXPORT_CATEGORIES,
  formatExportScope,
  mergeValidationSummaries,
  normalizeExportCategories,
} from "../src/services/export-scope.js";

describe("export scope helpers", () => {
  it("uses the default categories when none are provided", () => {
    expect(normalizeExportCategories()).toEqual(DEFAULT_EXPORT_CATEGORIES);
  });

  it("deduplicates selected categories", () => {
    expect(normalizeExportCategories(["walls", "rooms", "walls"]))
      .toEqual(["walls", "rooms"]);
  });

  it("formats the export scope for the project sheet", () => {
    expect(formatExportScope(["walls", "windows"]))
      .toBe("Walls, Windows");
  });

  it("merges validation summaries", () => {
    const merged = mergeValidationSummaries([
      {
        totalLines: 2,
        unmappedLines: 1,
        totalQuantity: 10,
        issues: [{ code: "UNMAPPED_CATEGORY", message: "Missing mapping", sourceCategory: "OST_Walls", sourceElementIds: [1] }],
      },
      {
        totalLines: 3,
        unmappedLines: 0,
        totalQuantity: 4,
        issues: [],
      },
    ]);

    expect(merged).toEqual({
      totalLines: 5,
      unmappedLines: 1,
      totalQuantity: 14,
      issues: [{ code: "UNMAPPED_CATEGORY", message: "Missing mapping", sourceCategory: "OST_Walls", sourceElementIds: [1] }],
    });
  });
});
