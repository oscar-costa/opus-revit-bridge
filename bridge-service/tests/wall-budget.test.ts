import { describe, expect, it } from "vitest";
import { buildWallQuantityCandidates } from "../src/services/wall-budget.js";

describe("buildWallQuantityCandidates", () => {
  it("converts wall info into normalized quantity candidates", () => {
    const result = buildWallQuantityCandidates([
      {
        id: 101,
        typeName: "Generic - 200 mm",
        length: 7.25,
        baseLevel: "Level 1",
        topConstraint: "Level 2",
      },
    ]);

    expect(result).toEqual([
      {
        sourceCategory: "OST_Walls",
        sourceElementIds: [101],
        description: "Generic - 200 mm",
        unit: "m",
        quantity: 7.25,
        levelName: "Level 1",
      },
    ]);
  });
});
