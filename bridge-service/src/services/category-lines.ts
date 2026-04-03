import { RevitClient } from "../revit-client.js";
import type {
  GetElementsByCategoryResponse,
  GetRoomsResponse,
  GetWallsResponse,
  NormalizedBudgetLine,
  SupportedExportCategory,
  ValidationSummary,
} from "../types.js";
import { buildCountQuantityCandidates } from "./count-budget.js";
import { mergeValidationSummaries } from "./export-scope.js";
import {
  applyMappingRules,
  buildValidationSummary,
  type MappingRule,
} from "./mapping-service.js";
import { buildRoomQuantityCandidates } from "./room-budget.js";
import { buildWallQuantityCandidates } from "./wall-budget.js";

export interface CategoryLineResult {
  category: SupportedExportCategory;
  lines: NormalizedBudgetLine[];
  summary: ValidationSummary;
}

export async function buildCategoryLineResult(
  revitClient: RevitClient,
  category: SupportedExportCategory,
  rules: MappingRule[]
): Promise<CategoryLineResult> {
  switch (category) {
    case "walls": {
      const wallResult = await revitClient.send<GetWallsResponse>({
        method: "get_walls",
        params: {},
      });
      const candidates = buildWallQuantityCandidates(wallResult.walls);
      const lines = applyMappingRules(candidates, rules);

      return {
        category,
        lines,
        summary: buildValidationSummary(lines),
      };
    }

    case "rooms": {
      const roomResult = await revitClient.send<GetRoomsResponse>({
        method: "get_rooms",
        params: {},
      });
      const candidates = buildRoomQuantityCandidates(roomResult.rooms);
      const lines = applyMappingRules(candidates, rules);

      return {
        category,
        lines,
        summary: buildValidationSummary(lines),
      };
    }

    case "doors": {
      const result = await revitClient.send<GetElementsByCategoryResponse>({
        method: "get_elements_by_category",
        params: { category: "OST_Doors" },
      });
      const candidates = buildCountQuantityCandidates("OST_Doors", result.elements);
      const lines = applyMappingRules(candidates, rules);

      return {
        category,
        lines,
        summary: buildValidationSummary(lines),
      };
    }

    case "windows": {
      const result = await revitClient.send<GetElementsByCategoryResponse>({
        method: "get_elements_by_category",
        params: { category: "OST_Windows" },
      });
      const candidates = buildCountQuantityCandidates("OST_Windows", result.elements);
      const lines = applyMappingRules(candidates, rules);

      return {
        category,
        lines,
        summary: buildValidationSummary(lines),
      };
    }
  }
}

export async function buildCombinedCategoryLineResults(
  revitClient: RevitClient,
  categories: SupportedExportCategory[],
  rules: MappingRule[]
): Promise<{
  results: CategoryLineResult[];
  lines: NormalizedBudgetLine[];
  summary: ValidationSummary;
}> {
  const results: CategoryLineResult[] = [];

  for (const category of categories) {
    results.push(await buildCategoryLineResult(revitClient, category, rules));
  }

  return {
    results,
    lines: results.flatMap((result) => result.lines),
    summary: mergeValidationSummaries(results.map((result) => result.summary)),
  };
}
