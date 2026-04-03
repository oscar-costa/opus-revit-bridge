import type { QuantityCandidate } from "./mapping-service.js";
import type { WallInfo } from "../types.js";

export function buildWallQuantityCandidates(walls: WallInfo[]): QuantityCandidate[] {
  return walls.map((wall) => ({
    sourceCategory: "OST_Walls",
    sourceElementIds: [wall.id],
    description: wall.typeName,
    unit: "m",
    quantity: wall.length,
    levelName: wall.baseLevel,
  }));
}
