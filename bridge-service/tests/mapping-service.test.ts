import { describe, expect, it } from "vitest";
import {
  applyMappingRules,
  type MappingRule,
  type QuantityCandidate,
} from "../src/services/mapping-service.js";

describe("applyMappingRules", () => {
  it("marks unmapped categories with a fallback code", () => {
    const candidates: QuantityCandidate[] = [
      {
        sourceCategory: "OST_Walls",
        sourceElementIds: [101, 102],
        description: "Generic - 200 mm",
        unit: "m2",
        quantity: 125.4,
        levelName: "Level 1",
      },
    ];

    const rules: MappingRule[] = [];
    const [line] = applyMappingRules(candidates, rules);

    expect(line.conceptCode).toBe("UNMAPPED");
    expect(line.description).toBe("Generic - 200 mm");
    expect(line.unit).toBe("m2");
  });

  it("applies configured Opus concept metadata", () => {
    const candidates: QuantityCandidate[] = [
      {
        sourceCategory: "OST_Walls",
        sourceElementIds: [101],
        description: "Original",
        unit: "m2",
        quantity: 4,
      },
    ];

    const rules: MappingRule[] = [
      {
        sourceCategory: "OST_Walls",
        conceptCode: "OP-001",
        description: "Concrete wall",
        unit: "m2",
      },
    ];

    const [line] = applyMappingRules(candidates, rules);

    expect(line.conceptCode).toBe("OP-001");
    expect(line.description).toBe("Concrete wall");
    expect(line.unit).toBe("m2");
  });
});
