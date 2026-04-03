import { describe, expect, it } from "vitest";
import { buildRoomQuantityCandidates } from "../src/services/room-budget.js";

describe("buildRoomQuantityCandidates", () => {
  it("converts room info into normalized quantity candidates", () => {
    const result = buildRoomQuantityCandidates([
      {
        id: 201,
        name: "Living Room",
        number: "101",
        area: 24.5,
        level: "Level 1",
      },
    ]);

    expect(result).toEqual([
      {
        sourceCategory: "OST_Rooms",
        sourceElementIds: [201],
        description: "101 - Living Room",
        unit: "m2",
        quantity: 24.5,
        levelName: "Level 1",
      },
    ]);
  });
});
