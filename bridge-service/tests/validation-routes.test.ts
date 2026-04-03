import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { createServer } from "../src/server.js";
import type { MappingRule } from "../src/services/mapping-service.js";
import type { RevitRequest } from "../src/types.js";

const startedServers: Array<{ close: () => Promise<void> }> = [];

function createRevitClientStub(requestLog: RevitRequest[] = []) {
  return {
    async send<T>(request: RevitRequest): Promise<T> {
      requestLog.push(request);

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
  const entry = {
    close: () => new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    }),
  };

  startedServers.push(entry);

  return `http://127.0.0.1:${port}`;
}

afterEach(async () => {
  await Promise.all(startedServers.splice(0).map((server) => server.close()));
});

describe("validation routes", () => {
  it("validates a selected combined category set", async () => {
    const requestLog: RevitRequest[] = [];
    const baseUrl = await startTestServer(createRevitClientStub(requestLog));
    const mappingRules: MappingRule[] = [
      { sourceCategory: "OST_Walls", conceptCode: "MURO-001", unit: "m" },
      { sourceCategory: "OST_Doors", conceptCode: "PUERTA-001", unit: "pza" },
    ];

    const response = await fetch(`${baseUrl}/api/validate/combined`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ categories: ["walls", "doors"], mappingRules }),
    });

    const payload = await response.json() as {
      ok: boolean;
      data: {
        categories: string[];
        lines: Array<{ conceptCode: string }>;
        summary: {
          totalLines: number;
          unmappedLines: number;
          totalQuantity: number;
          issues: unknown[];
        };
        categorySummaries: Record<string, { totalLines: number }>;
      };
    };

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.data.categories).toEqual(["walls", "doors"]);
    expect(payload.data.summary).toMatchObject({
      totalLines: 2,
      unmappedLines: 0,
      totalQuantity: 9.25,
    });
    expect(payload.data.summary.issues).toEqual([]);
    expect(payload.data.categorySummaries.walls.totalLines).toBe(1);
    expect(payload.data.categorySummaries.doors.totalLines).toBe(1);
    expect(payload.data.lines.map((line) => line.conceptCode)).toEqual([
      "MURO-001",
      "PUERTA-001",
    ]);
    expect(requestLog).toEqual([
      { method: "get_walls", params: {} },
      { method: "get_elements_by_category", params: { category: "OST_Doors" } },
    ]);
  });

  it("defaults to all supported categories when none are provided", async () => {
    const baseUrl = await startTestServer(createRevitClientStub());
    const mappingRules: MappingRule[] = [
      { sourceCategory: "OST_Walls", conceptCode: "MURO-001", unit: "m" },
      { sourceCategory: "OST_Rooms", conceptCode: "AREA-001", unit: "m2" },
      { sourceCategory: "OST_Doors", conceptCode: "PUERTA-001", unit: "pza" },
    ];

    const response = await fetch(`${baseUrl}/api/validate/combined`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mappingRules }),
    });

    const payload = await response.json() as {
      ok: boolean;
      data: {
        categories: string[];
        summary: { totalLines: number; unmappedLines: number };
        categorySummaries: Record<string, { totalLines: number; unmappedLines: number }>;
      };
    };

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.data.categories).toEqual(["walls", "rooms", "doors", "windows"]);
    expect(payload.data.summary.totalLines).toBe(4);
    expect(payload.data.summary.unmappedLines).toBe(1);
    expect(payload.data.categorySummaries.windows.totalLines).toBe(1);
    expect(payload.data.categorySummaries.windows.unmappedLines).toBe(1);
  });

  it("returns a 500 response when the Revit query fails", async () => {
    const failingClient = {
      async send<T>(_request: RevitRequest): Promise<T> {
        throw new Error("Revit bridge unavailable");
      },
    };
    const baseUrl = await startTestServer(failingClient);

    const response = await fetch(`${baseUrl}/api/validate/combined`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ categories: ["rooms"] }),
    });

    const payload = await response.json() as {
      ok: boolean;
      error: string;
    };

    expect(response.status).toBe(500);
    expect(payload).toEqual({
      ok: false,
      error: "Revit bridge unavailable",
    });
  });
});
