import { describe, expect, it } from "vitest";
import {
  buildValidationSummary,
  loadMappingRules,
} from "../src/services/mapping-service.js";

describe("mapping config", () => {
  it("loads default mapping rules from config", async () => {
    const rules = await loadMappingRules();

    expect(rules.length).toBeGreaterThan(0);
    expect(rules[0]?.sourceCategory).toBe("OST_Walls");
    expect(rules[0]?.conceptCode).toBe("OP-WALL-001");
    expect(rules[0]?.unit).toBe("m");
  });

  it("reports unmapped lines in validation summary", () => {
    const summary = buildValidationSummary([
      {
        conceptCode: "UNMAPPED",
        description: "Wall length",
        unit: "m",
        quantity: 12,
        sourceCategory: "OST_Walls",
        sourceElementIds: [1001],
        levelName: "Level 1",
      },
      {
        conceptCode: "OP-WALL-001",
        description: "Wall length",
        unit: "m",
        quantity: 4,
        sourceCategory: "OST_Walls",
        sourceElementIds: [1002],
        levelName: "Level 1",
      },
    ]);

    expect(summary.totalLines).toBe(2);
    expect(summary.unmappedLines).toBe(1);
    expect(summary.totalQuantity).toBe(16);
    expect(summary.issues[0]?.code).toBe("UNMAPPED_CATEGORY");
  });

  it("reports invalid quantities and missing units", () => {
    const summary = buildValidationSummary([
      {
        conceptCode: "OP-WALL-001",
        description: "Wall length",
        unit: "",
        quantity: 0,
        sourceCategory: "OST_Walls",
        sourceElementIds: [1003],
        levelName: "Level 1",
      },
    ]);

    expect(summary.issues.map((issue) => issue.code)).toEqual([
      "MISSING_UNIT",
      "INVALID_QUANTITY",
    ]);
  });
});
