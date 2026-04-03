import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  buildStampedFileName,
  loadExportConfig,
  loadWorkbookTemplate,
  resolveOutputDirectory,
  saveWorkbookBuffer,
} from "../src/services/export-storage.js";
import {
  CONFIG_DIR_ENV_VAR,
  DATA_DIR_ENV_VAR,
  SERVICE_ROOT_ENV_VAR,
} from "../src/services/project-paths.js";

const originalEnvironment = {
  [SERVICE_ROOT_ENV_VAR]: process.env[SERVICE_ROOT_ENV_VAR],
  [CONFIG_DIR_ENV_VAR]: process.env[CONFIG_DIR_ENV_VAR],
  [DATA_DIR_ENV_VAR]: process.env[DATA_DIR_ENV_VAR],
};

afterEach(() => {
  for (const [key, value] of Object.entries(originalEnvironment)) {
    if (value === undefined) {
      delete process.env[key];
      continue;
    }

    process.env[key] = value;
  }
});

describe("export storage", () => {
  it("loads the default export config", async () => {
    const config = await loadExportConfig();

    expect(config.outputDirectory.endsWith(path.join("bridge-service", "output"))).toBe(true);
    expect(config.fileNamePrefix).toBe("opus-export");
    expect(config.templateConfigPath?.endsWith(path.join("bridge-service", "config", "opus-template.json")))
      .toBe(true);
  });

  it("loads the default workbook template", async () => {
    const template = await loadWorkbookTemplate();

    expect(template.projectSheet?.name).toBe("Project");
    expect(template.importSheet.name).toBe("Opus Import");
    expect(template.importSheet.columns[0]?.sourceKey).toBe("conceptCode");
    expect(template.importSheet.columns[2]?.header).toBe("Unidad");
    expect(template.importSheet.columns[3]?.sourceKey).toBe("quantity");
    expect(template.traceabilitySheet?.name).toBe("Traceability");
    expect(template.traceabilitySheet?.columns[4]?.sourceKey).toBe("sourceElementIds");
  });

  it("resolves relative output directories under the project root", () => {
    const resolved = resolveOutputDirectory("./output");

    expect(resolved.endsWith(path.join("bridge-service", "output"))).toBe(true);
  });

  it("resolves relative output directories under the configured data directory", () => {
    process.env[SERVICE_ROOT_ENV_VAR] = "C:\\Program Files\\Opus Revit Bridge\\bridge-service";
    process.env[DATA_DIR_ENV_VAR] = "C:\\ProgramData\\Opus Revit Bridge";

    expect(resolveOutputDirectory("./output"))
      .toBe(path.resolve("C:\\ProgramData\\Opus Revit Bridge\\output"));
  });

  it("keeps repo-style template paths working when config lives outside the service root", async () => {
    process.env[SERVICE_ROOT_ENV_VAR] = "C:\\Program Files\\Opus Revit Bridge\\bridge-service";
    process.env[CONFIG_DIR_ENV_VAR] = path.resolve("./config");
    process.env[DATA_DIR_ENV_VAR] = "C:\\ProgramData\\Opus Revit Bridge";

    const config = await loadExportConfig();

    expect(config.templateConfigPath)
      .toBe(path.resolve("./config/opus-template.json"));
  });

  it("saves workbook buffers to disk", async () => {
    const tempDirectory = await mkdtemp(path.join(os.tmpdir(), "opus-export-"));

    try {
      const saved = await saveWorkbookBuffer(
        "test.xlsx",
        Buffer.from("workbook"),
        tempDirectory
      );

      const fileContents = await readFile(saved.outputPath, "utf8");

      expect(saved.fileName).toBe("test.xlsx");
      expect(fileContents).toBe("workbook");
    } finally {
      await rm(tempDirectory, { recursive: true, force: true });
    }
  });

  it("builds stamped file names with the configured prefix", () => {
    const fileName = buildStampedFileName("opus-export", "walls");

    expect(fileName.startsWith("opus-export-walls-")).toBe(true);
    expect(fileName.endsWith(".xlsx")).toBe(true);
  });
});
