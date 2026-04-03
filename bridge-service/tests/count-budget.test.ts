import { describe, expect, it } from "vitest";
import { buildCountQuantityCandidates } from "../src/services/count-budget.js";

describe("buildCountQuantityCandidates", () => {
  it("aggregates elements by category, type, and level", () => {
    const result = buildCountQuantityCandidates("OST_Doors", [
      {
        id: 1,
        name: "Single-Flush",
        typeName: "Single-Flush 0915 x 2134mm",
        level: "Level 1",
      },
      {
        id: 2,
        name: "Single-Flush",
        typeName: "Single-Flush 0915 x 2134mm",
        level: "Level 1",
      },
      {
        id: 3,
        name: "Single-Flush",
        typeName: "Single-Flush 0915 x 2134mm",
        level: "Level 2",
      },
    ]);

    expect(result).toEqual([
      {
        sourceCategory: "OST_Doors",
        sourceElementIds: [1, 2],
        description: "Single-Flush 0915 x 2134mm",
        unit: "pza",
        quantity: 2,
        levelName: "Level 1",
      },
      {
        sourceCategory: "OST_Doors",
        sourceElementIds: [3],
        description: "Single-Flush 0915 x 2134mm",
        unit: "pza",
        quantity: 1,
        levelName: "Level 2",
      },
    ]);
  });
});
