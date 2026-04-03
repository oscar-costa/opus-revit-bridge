import { describe, expect, it } from "vitest";
import { RevitClient } from "../src/revit-client.js";
import type { MappingRule } from "../src/services/mapping-service.js";
import type { RevitRequest } from "../src/types.js";
import {
  buildCategoryLineResult,
  buildCombinedCategoryLineResults,
} from "../src/services/category-lines.js";

const defaultRules: MappingRule[] = [
  {
    sourceCategory: "OST_Walls",
    conceptCode: "MURO-001",
    unit: "m",
  },
  {
    sourceCategory: "OST_Rooms",
    conceptCode: "AREA-001",
    unit: "m2",
  },
  {
    sourceCategory: "OST_Doors",
    conceptCode: "PUERTA-001",
    unit: "pza",
  },
];

function createRevitClientStub() {
  return {
    async send<T>(request: RevitRequest): Promise<T> {
      if (request.method === "get_walls") {
        return {
          walls: [
            {
              id: 101,
              typeName: "Generic - 200 mm",
              length: 7.25,
              baseLevel: "Level 1",
              topConstraint: "Level 2",
            },
          ],
        } as T;
      }

      if (request.method === "get_rooms") {
        return {
          rooms: [
            {
              id: 201,
              name: "Living Room",
              number: "101",
              area: 24.5,
              level: "Level 1",
            },
          ],
        } as T;
      }

      if (request.method === "get_elements_by_category") {
        return {
          category: request.params?.category,
          elements: [
            {
              id: 301,
              name: "Single-Flush",
              typeName: "Single-Flush 0915 x 2134mm",
              level: "Level 1",
            },
            {
              id: 302,
              name: "Single-Flush",
              typeName: "Single-Flush 0915 x 2134mm",
              level: "Level 1",
            },
          ],
        } as T;
      }

      throw new Error(`Unexpected method: ${request.method}`);
    },
  } as RevitClient;
}

describe("category line builders", () => {
  it("builds mapped lines for a single category", async () => {
    const result = await buildCategoryLineResult(
      createRevitClientStub(),
      "walls",
      defaultRules
    );

    expect(result.category).toBe("walls");
    expect(result.summary.totalLines).toBe(1);
    expect(result.lines).toEqual([
      {
        conceptCode: "MURO-001",
        description: "Generic - 200 mm",
        unit: "m",
        quantity: 7.25,
        sourceCategory: "OST_Walls",
        sourceElementIds: [101],
        levelName: "Level 1",
      },
    ]);
  });

  it("builds and merges combined category results", async () => {
    const result = await buildCombinedCategoryLineResults(
      createRevitClientStub(),
      ["walls", "rooms", "doors"],
      defaultRules
    );

    expect(result.results.map((entry) => entry.category)).toEqual([
      "walls",
      "rooms",
      "doors",
    ]);
    expect(result.summary.totalLines).toBe(3);
    expect(result.summary.unmappedLines).toBe(0);
    expect(result.summary.totalQuantity).toBe(33.75);
    expect(result.lines).toHaveLength(3);
  });
});
