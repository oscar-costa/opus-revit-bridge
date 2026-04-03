import type { AddressInfo } from "node:net";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import ExcelJS from "exceljs";
import { afterEach, describe, expect, it } from "vitest";
import { createServer } from "../src/server.js";
import type { MappingRule } from "../src/services/mapping-service.js";
import type { RevitRequest } from "../src/types.js";

const startedServers: Array<{ close: () => Promise<void> }> = [];
const temporaryDirectories: string[] = [];

function createRevitClientStub(requestLog: RevitRequest[] = []) {
  return {
    async send<T>(request: RevitRequest): Promise<T> {
      requestLog.push(request);

      if (request.method === "get_project_info") {
        return {
          name: "Sample Project",
          address: "Sample Address",
          clientName: "Sample Client",
          projectNumber: "PRJ-001",
        } as T;
      }

      if (request.method === "get_walls") {
        return {
          walls: [
            {
              id: 101,
              typeName: "Generic - 200 mm",
              length: 7.25,
              baseLevel: "Level 1",
              topConstraint: "Level 2",
            },
          ],
        } as T;
      }

      if (request.method === "get_rooms") {
        return {
          rooms: [
            {
              id: 201,
              name: "Living Room",
              number: "101",
              area: 24.5,
              level: "Level 1",
            },
          ],
        } as T;
      }

      if (request.method === "get_elements_by_category") {
        const category = request.params?.category;

        return {
          category,
          elements:
            category === "OST_Windows"
              ? [
                {
                  id: 401,
                  name: "Fixed",
                  typeName: "Fixed 1200 x 1200mm",
                  level: "Level 1",
                },
                {
                  id: 402,
                  name: "Fixed",
                  typeName: "Fixed 1200 x 1200mm",
                  level: "Level 1",
                },
              ]
              : [
                {
                  id: 301,
                  name: "Single-Flush",
                  typeName: "Single-Flush 0915 x 2134mm",
                  level: "Level 1",
                },
                {
                  id: 302,
                  name: "Single-Flush",
                  typeName: "Single-Flush 0915 x 2134mm",
                  level: "Level 1",
                },
              ],
        } as T;
      }

      throw new Error(`Unexpected method: ${request.method}`);
    },
  };
}

async function startTestServer(revitClient: object) {
  const app = createServer(revitClient as never);

  const server = await new Promise<import("node:http").Server>((resolve) => {
    const instance = app.listen(0, "127.0.0.1", () => resolve(instance));
  });

  const { port } = server.address() as AddressInfo;
  startedServers.push({
    close: () => new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    }),
  });

  return `http://127.0.0.1:${port}`;
}

afterEach(async () => {
  await Promise.all(startedServers.splice(0).map((server) => server.close()));
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true }))
  );
});

describe("export routes", () => {
  it("exports a selected combined category workbook as xlsx", async () => {
    const requestLog: RevitRequest[] = [];
    const baseUrl = await startTestServer(createRevitClientStub(requestLog));
    const mappingRules: MappingRule[] = [
      { sourceCategory: "OST_Walls", conceptCode: "MURO-001", unit: "m" },
      { sourceCategory: "OST_Rooms", conceptCode: "AREA-001", unit: "m2" },
    ];

    const response = await fetch(`${baseUrl}/api/export/combined/xlsx`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        categories: ["walls", "rooms"],
        mappingRules,
        fileName: "combined-test.xlsx",
      }),
    });

    const workbookBuffer = Buffer.from(await response.arrayBuffer());
    const workbook = new ExcelJS.Workbook();
    const workbookInput = workbookBuffer as unknown as Parameters<typeof workbook.xlsx.load>[0];
    await workbook.xlsx.load(workbookInput);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type"))
      .toContain("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    expect(response.headers.get("content-disposition"))
      .toContain('filename="combined-test.xlsx"');
    expect(response.headers.get("x-opus-unmapped-count")).toBe("0");
    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual([
      "Project",
      "Opus Import",
      "Metadata",
      "Traceability",
    ]);
    expect(workbook.getWorksheet("Project")?.getRow(6).getCell(2).value).toBe(
      "Walls, Rooms"
    );
    expect(workbook.getWorksheet("Opus Import")?.getRow(2).getCell(1).value).toBe(
      "MURO-001"
    );
    expect(workbook.getWorksheet("Opus Import")?.getRow(3).getCell(1).value).toBe(
      "AREA-001"
    );
    expect(requestLog).toEqual([
      { method: "get_project_info", params: {} },
      { method: "get_walls", params: {} },
      { method: "get_rooms", params: {} },
    ]);
  });

  it("saves a combined workbook to disk", async () => {
    const baseUrl = await startTestServer(createRevitClientStub());
    const outputDirectory = await mkdtemp(path.join(os.tmpdir(), "opus-export-route-"));
    temporaryDirectories.push(outputDirectory);
    const mappingRules: MappingRule[] = [
      { sourceCategory: "OST_Doors", conceptCode: "PUERTA-001", unit: "pza" },
    ];

    const response = await fetch(`${baseUrl}/api/export/combined/file`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        categories: ["doors"],
        mappingRules,
        outputDirectory,
        fileName: "combined-file-test.xlsx",
      }),
    });

    const payload = await response.json() as {
      ok: boolean;
      data: {
        fileName: string;
        outputPath: string;
        unmappedLines: number;
        totalLines: number;
        categories: string[];
      };
    };

    const savedBuffer = await readFile(payload.data.outputPath);
    const workbook = new ExcelJS.Workbook();
    const workbookInput = savedBuffer as unknown as Parameters<typeof workbook.xlsx.load>[0];
    await workbook.xlsx.load(workbookInput);

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.data.fileName).toBe("combined-file-test.xlsx");
    expect(payload.data.outputPath.startsWith(outputDirectory)).toBe(true);
    expect(payload.data.unmappedLines).toBe(0);
    expect(payload.data.totalLines).toBe(1);
    expect(payload.data.categories).toEqual(["doors"]);
    expect(workbook.getWorksheet("Project")?.getRow(6).getCell(2).value).toBe(
      "Doors"
    );
    expect(workbook.getWorksheet("Opus Import")?.getRow(2).getCell(1).value).toBe(
      "PUERTA-001"
    );
  });

  it("blocks combined export when unmapped lines exist", async () => {
    const baseUrl = await startTestServer(createRevitClientStub());

    const response = await fetch(`${baseUrl}/api/export/combined/xlsx`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ categories: ["windows"], mappingRules: [] }),
    });

    const payload = await response.json() as {
      ok: boolean;
      error: string;
      data: {
        totalLines: number;
        unmappedLines: number;
      };
    };

    expect(response.status).toBe(400);
    expect(payload.ok).toBe(false);
    expect(payload.error).toContain("Export blocked because some lines are unmapped");
    expect(payload.data.totalLines).toBe(1);
    expect(payload.data.unmappedLines).toBe(1);
  });
});
