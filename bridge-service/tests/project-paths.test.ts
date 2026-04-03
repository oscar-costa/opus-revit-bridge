import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  findProjectRoot,
  resolveProjectPath,
} from "../src/services/project-paths.js";

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
});