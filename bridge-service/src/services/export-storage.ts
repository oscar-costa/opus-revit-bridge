import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type {
  ExportConfig,
  SavedWorkbookResult,
  WorkbookTemplateConfig,
} from "../types.js";
import { findProjectRoot, resolveProjectPath } from "./project-paths.js";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = findProjectRoot(currentDirectory);
const defaultExportConfigPath = path.resolve(projectRoot, "config/export.json");
const defaultTemplateConfigPath = path.resolve(projectRoot, "config/opus-template.json");

export async function loadExportConfig(configPath = defaultExportConfigPath): Promise<ExportConfig> {
  const raw = await readFile(resolveProjectPath(projectRoot, configPath), "utf8");
  return JSON.parse(raw) as ExportConfig;
}

export async function loadWorkbookTemplate(
  configPath = defaultTemplateConfigPath
): Promise<WorkbookTemplateConfig> {
  const raw = await readFile(resolveProjectPath(projectRoot, configPath), "utf8");
  return JSON.parse(raw) as WorkbookTemplateConfig;
}

export function resolveOutputDirectory(outputDirectory: string): string {
  return path.isAbsolute(outputDirectory)
    ? outputDirectory
    : path.resolve(projectRoot, outputDirectory);
}

export function buildStampedFileName(fileNamePrefix: string, suffix: string): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `${fileNamePrefix}-${suffix}-${stamp}.xlsx`;
}

export async function saveWorkbookBuffer(
  fileName: string,
  buffer: Buffer,
  outputDirectory: string
): Promise<SavedWorkbookResult> {
  const resolvedOutputDirectory = resolveOutputDirectory(outputDirectory);
  await mkdir(resolvedOutputDirectory, { recursive: true });

  const outputPath = path.join(resolvedOutputDirectory, fileName);
  await writeFile(outputPath, buffer);

  return {
    fileName,
    buffer,
    outputPath,
  };
}
