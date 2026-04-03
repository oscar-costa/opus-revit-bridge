import { existsSync } from "node:fs";
import path from "node:path";

export const SERVICE_ROOT_ENV_VAR = "OPUS_BRIDGE_SERVICE_ROOT";
export const CONFIG_DIR_ENV_VAR = "OPUS_BRIDGE_CONFIG_DIR";
export const DATA_DIR_ENV_VAR = "OPUS_BRIDGE_DATA_DIR";

export interface RuntimePaths {
  serviceRoot: string;
  configDirectory: string;
  dataDirectory: string;
}

function resolveEnvironmentDirectory(variableName: string): string | undefined {
  const configuredPath = process.env[variableName]?.trim();

  return configuredPath ? path.resolve(configuredPath) : undefined;
}

function isRuntimeRoot(candidateDirectory: string): boolean {
  return existsSync(path.join(candidateDirectory, "config"));
}

function stripConfigPrefix(targetPath: string): string {
  return targetPath.replace(/^(\.\\|\.\/)?config[\\/]/, "");
}

export function findServiceRoot(startDirectory: string): string {
  const configuredServiceRoot = resolveEnvironmentDirectory(SERVICE_ROOT_ENV_VAR);
  if (configuredServiceRoot) {
    return configuredServiceRoot;
  }

  let currentDirectory = path.resolve(startDirectory);

  while (true) {
    if (isRuntimeRoot(currentDirectory)) {
      return currentDirectory;
    }

    const parentDirectory = path.dirname(currentDirectory);
    if (parentDirectory === currentDirectory) {
      throw new Error(
        `Could not resolve bridge-service root from ${startDirectory}. ` +
        `Set ${SERVICE_ROOT_ENV_VAR} for installed deployments.`
      );
    }

    currentDirectory = parentDirectory;
  }
}

export function findProjectRoot(startDirectory: string): string {
  return findServiceRoot(startDirectory);
}

export function getRuntimePaths(startDirectory: string): RuntimePaths {
  const serviceRoot = findServiceRoot(startDirectory);

  return {
    serviceRoot,
    configDirectory:
      resolveEnvironmentDirectory(CONFIG_DIR_ENV_VAR) ?? path.join(serviceRoot, "config"),
    dataDirectory:
      resolveEnvironmentDirectory(DATA_DIR_ENV_VAR) ?? serviceRoot,
  };
}

export function resolveProjectPath(projectRoot: string, targetPath: string): string {
  return path.isAbsolute(targetPath)
    ? targetPath
    : path.resolve(projectRoot, targetPath);
}

export function resolveRuntimeConfigPath(
  runtimePaths: RuntimePaths,
  targetPath: string
): string {
  if (path.isAbsolute(targetPath)) {
    return targetPath;
  }

  const serviceRootCandidate = path.resolve(runtimePaths.serviceRoot, targetPath);
  if (existsSync(serviceRootCandidate)) {
    return serviceRootCandidate;
  }

  const configDirectoryCandidate = path.resolve(runtimePaths.configDirectory, targetPath);
  if (existsSync(configDirectoryCandidate)) {
    return configDirectoryCandidate;
  }

  const normalizedConfigPath = stripConfigPrefix(targetPath);
  if (normalizedConfigPath !== targetPath) {
    const normalizedConfigCandidate = path.resolve(
      runtimePaths.configDirectory,
      normalizedConfigPath
    );

    if (existsSync(normalizedConfigCandidate)) {
      return normalizedConfigCandidate;
    }
  }

  return serviceRootCandidate;
}

export function resolveRuntimeDataPath(runtimePaths: RuntimePaths, targetPath: string): string {
  return path.isAbsolute(targetPath)
    ? targetPath
    : path.resolve(runtimePaths.dataDirectory, targetPath);
}
