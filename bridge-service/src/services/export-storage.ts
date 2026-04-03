import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type {
  ExportConfig,
  SavedWorkbookResult,
  WorkbookTemplateConfig,
} from "../types.js";
import {
  getRuntimePaths,
  resolveRuntimeConfigPath,
  resolveRuntimeDataPath,
} from "./project-paths.js";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));

function getStoragePaths() {
  const runtimePaths = getRuntimePaths(currentDirectory);

  return {
    runtimePaths,
    defaultExportConfigPath: path.join(runtimePaths.configDirectory, "export.json"),
    defaultTemplateConfigPath: path.join(runtimePaths.configDirectory, "opus-template.json"),
  };
}

export async function loadExportConfig(configPath?: string): Promise<ExportConfig> {
  const { runtimePaths, defaultExportConfigPath } = getStoragePaths();
  const resolvedConfigPath = resolveRuntimeConfigPath(
    runtimePaths,
    configPath ?? defaultExportConfigPath
  );
  const raw = await readFile(resolvedConfigPath, "utf8");
  const config = JSON.parse(raw) as ExportConfig;

  return {
    ...config,
    outputDirectory: resolveRuntimeDataPath(runtimePaths, config.outputDirectory),
    templateConfigPath: config.templateConfigPath
      ? resolveRuntimeConfigPath(runtimePaths, config.templateConfigPath)
      : undefined,
  };
}

export async function loadWorkbookTemplate(
  configPath?: string
): Promise<WorkbookTemplateConfig> {
  const { runtimePaths, defaultTemplateConfigPath } = getStoragePaths();
  const resolvedConfigPath = resolveRuntimeConfigPath(
    runtimePaths,
    configPath ?? defaultTemplateConfigPath
  );
  const raw = await readFile(resolvedConfigPath, "utf8");
  return JSON.parse(raw) as WorkbookTemplateConfig;
}

export function resolveOutputDirectory(outputDirectory: string): string {
  const { runtimePaths } = getStoragePaths();
  return resolveRuntimeDataPath(runtimePaths, outputDirectory);
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
