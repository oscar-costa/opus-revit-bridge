import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NormalizedBudgetLine } from "../types.js";
import type { MappingConfig, ValidationSummary } from "../types.js";
import { findProjectRoot, resolveProjectPath } from "./project-paths.js";

export interface QuantityCandidate {
  sourceCategory: string;
  sourceElementIds: number[];
  description: string;
  unit: string;
  quantity: number;
  levelName?: string;
}

export interface MappingRule {
  sourceCategory: string;
  conceptCode: string;
  description?: string;
  unit?: string;
}

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = findProjectRoot(currentDirectory);
const defaultMappingConfigPath = path.resolve(projectRoot, "config/mappings.json");

export async function loadMappingConfig(configPath = defaultMappingConfigPath): Promise<MappingConfig> {
  const raw = await readFile(resolveProjectPath(projectRoot, configPath), "utf8");
  return JSON.parse(raw) as MappingConfig;
}

export async function loadMappingRules(configPath?: string): Promise<MappingRule[]> {
  const config = await loadMappingConfig(configPath);
  return config.rules;
}

export function applyMappingRules(
  candidates: QuantityCandidate[],
  rules: MappingRule[]
): NormalizedBudgetLine[] {
  const rulesByCategory = new Map(rules.map((rule) => [rule.sourceCategory, rule]));

  return candidates.map((candidate) => {
    const rule = rulesByCategory.get(candidate.sourceCategory);

    return {
      conceptCode: rule?.conceptCode ?? "UNMAPPED",
      description: rule?.description ?? candidate.description,
      unit: rule?.unit ?? candidate.unit,
      quantity: candidate.quantity,
      sourceCategory: candidate.sourceCategory,
      sourceElementIds: candidate.sourceElementIds,
      levelName: candidate.levelName,
    };
  });
}

export function buildValidationSummary(lines: NormalizedBudgetLine[]): ValidationSummary {
  const issues = lines.flatMap((line) => {
    const lineIssues = [];

    if (line.conceptCode === "UNMAPPED") {
      lineIssues.push({
        code: "UNMAPPED_CATEGORY",
        message: `No mapping rule found for category ${line.sourceCategory}.`,
        sourceCategory: line.sourceCategory,
        sourceElementIds: line.sourceElementIds,
      });
    }

    if (!line.unit.trim()) {
      lineIssues.push({
        code: "MISSING_UNIT",
        message: `No unit resolved for category ${line.sourceCategory}.`,
        sourceCategory: line.sourceCategory,
        sourceElementIds: line.sourceElementIds,
      });
    }

    if (line.quantity <= 0) {
      lineIssues.push({
        code: "INVALID_QUANTITY",
        message: `Quantity must be greater than zero for category ${line.sourceCategory}.`,
        sourceCategory: line.sourceCategory,
        sourceElementIds: line.sourceElementIds,
      });
    }

    return lineIssues;
  });

  return {
    totalLines: lines.length,
    unmappedLines: issues.length,
    totalQuantity: lines.reduce((sum, line) => sum + line.quantity, 0),
    issues,
  };
}
