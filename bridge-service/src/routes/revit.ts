import type { Express, Request, Response } from "express";
import { RevitClient } from "../revit-client.js";
import type {
  GetElementsByCategoryResponse,
  GetRoomsResponse,
  GetWallsResponse,
  ProjectInfo,
} from "../types.js";

export function registerRevitRoutes(app: Express, revitClient: RevitClient): void {
  app.get("/api/revit/project-info", async (_req: Request, res: Response) => {
    try {
      const projectInfo = await revitClient.send<ProjectInfo>({
        method: "get_project_info",
        params: {},
      });

      res.json({ ok: true, data: projectInfo });
    } catch (error) {
      res.status(502).json({
        ok: false,
        error: error instanceof Error ? error.message : "Unknown Revit error",
      });
    }
  });

  app.get("/api/revit/walls", async (_req: Request, res: Response) => {
    try {
      const wallResult = await revitClient.send<GetWallsResponse>({
        method: "get_walls",
        params: {},
      });

      res.json({ ok: true, data: wallResult.walls });
    } catch (error) {
      res.status(502).json({
        ok: false,
        error: error instanceof Error ? error.message : "Unknown Revit error",
      });
    }
  });

  app.get("/api/revit/rooms", async (_req: Request, res: Response) => {
    try {
      const roomResult = await revitClient.send<GetRoomsResponse>({
        method: "get_rooms",
        params: {},
      });

      res.json({ ok: true, data: roomResult.rooms });
    } catch (error) {
      res.status(502).json({
        ok: false,
        error: error instanceof Error ? error.message : "Unknown Revit error",
      });
    }
  });

  app.get("/api/revit/doors", async (_req: Request, res: Response) => {
    try {
      const result = await revitClient.send<GetElementsByCategoryResponse>({
        method: "get_elements_by_category",
        params: { category: "OST_Doors" },
      });

      res.json({ ok: true, data: result.elements });
    } catch (error) {
      res.status(502).json({
        ok: false,
        error: error instanceof Error ? error.message : "Unknown Revit error",
      });
    }
  });

  app.get("/api/revit/windows", async (_req: Request, res: Response) => {
    try {
      const result = await revitClient.send<GetElementsByCategoryResponse>({
        method: "get_elements_by_category",
        params: { category: "OST_Windows" },
      });

      res.json({ ok: true, data: result.elements });
    } catch (error) {
      res.status(502).json({
        ok: false,
        error: error instanceof Error ? error.message : "Unknown Revit error",
      });
    }
  });
}
