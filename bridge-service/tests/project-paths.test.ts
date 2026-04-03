import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  CONFIG_DIR_ENV_VAR,
  DATA_DIR_ENV_VAR,
  findProjectRoot,
  getRuntimePaths,
  resolveProjectPath,
  resolveRuntimeConfigPath,
  resolveRuntimeDataPath,
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

describe("findProjectRoot", () => {
  it("resolves the bridge-service root from the source tree", () => {
    const serviceRoot = path.resolve(".");
    const sourceDirectory = path.join(serviceRoot, "src", "services");

    expect(findProjectRoot(sourceDirectory)).toBe(serviceRoot);
  });

  it("resolves the bridge-service root from the compiled tree", () => {
    const serviceRoot = path.resolve(".");
    const distDirectory = path.join(serviceRoot, "dist", "src", "services");

    expect(findProjectRoot(distDirectory)).toBe(serviceRoot);
  });

  it("resolves relative project paths from the bridge-service root", () => {
    const serviceRoot = path.resolve(".");

    expect(resolveProjectPath(serviceRoot, "./config/opus-template.json"))
      .toBe(path.join(serviceRoot, "config", "opus-template.json"));
  });

  it("uses installer environment overrides for runtime directories", () => {
    const sourceDirectory = path.join(path.resolve("."), "src", "services");

    process.env[SERVICE_ROOT_ENV_VAR] = "C:\\Program Files\\Opus Revit Bridge\\bridge-service";
    process.env[CONFIG_DIR_ENV_VAR] = "C:\\ProgramData\\Opus Revit Bridge\\config";
    process.env[DATA_DIR_ENV_VAR] = "C:\\ProgramData\\Opus Revit Bridge";

    const runtimePaths = getRuntimePaths(sourceDirectory);

    expect(runtimePaths.serviceRoot)
      .toBe(path.resolve("C:\\Program Files\\Opus Revit Bridge\\bridge-service"));
    expect(runtimePaths.configDirectory)
      .toBe(path.resolve("C:\\ProgramData\\Opus Revit Bridge\\config"));
    expect(runtimePaths.dataDirectory)
      .toBe(path.resolve("C:\\ProgramData\\Opus Revit Bridge"));
  });

  it("resolves relative config paths from the configured config directory when needed", () => {
    const runtimePaths = {
      serviceRoot: path.resolve("C:\\Program Files\\Opus Revit Bridge\\bridge-service"),
      configDirectory: path.resolve("d:\\code\\__Github\\opus-revit-bridge\\bridge-service\\config"),
      dataDirectory: path.resolve("C:\\ProgramData\\Opus Revit Bridge"),
    };

    expect(resolveRuntimeConfigPath(runtimePaths, "mappings.json"))
      .toBe(path.resolve("d:\\code\\__Github\\opus-revit-bridge\\bridge-service\\config\\mappings.json"));
  });

  it("resolves relative output paths from the configured data directory", () => {
    const runtimePaths = {
      serviceRoot: path.resolve("C:\\Program Files\\Opus Revit Bridge\\bridge-service"),
      configDirectory: path.resolve("C:\\ProgramData\\Opus Revit Bridge\\config"),
      dataDirectory: path.resolve("C:\\ProgramData\\Opus Revit Bridge"),
    };

    expect(resolveRuntimeDataPath(runtimePaths, "./output"))
      .toBe(path.resolve("C:\\ProgramData\\Opus Revit Bridge\\output"));
  });
});
