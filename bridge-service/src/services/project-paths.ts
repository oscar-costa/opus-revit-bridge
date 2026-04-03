import { existsSync } from "node:fs";
import path from "node:path";

export function findProjectRoot(startDirectory: string): string {
  let currentDirectory = path.resolve(startDirectory);

  while (true) {
    if (existsSync(path.join(currentDirectory, "package.json"))) {
      return currentDirectory;
    }

    const parentDirectory = path.dirname(currentDirectory);
    if (parentDirectory === currentDirectory) {
      throw new Error(`Could not resolve bridge-service root from ${startDirectory}.`);
    }

    currentDirectory = parentDirectory;
  }
}

export function resolveProjectPath(projectRoot: string, targetPath: string): string {
  return path.isAbsolute(targetPath)
    ? targetPath
    : path.resolve(projectRoot, targetPath);
}