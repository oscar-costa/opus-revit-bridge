import type { Express, Request, Response } from "express";
import { RevitClient } from "../revit-client.js";
import {
  loadMappingRules,
  type MappingRule,
} from "../services/mapping-service.js";
import {
  buildCategoryLineResult,
  buildCombinedCategoryLineResults,
} from "../services/category-lines.js";
import { normalizeExportCategories } from "../services/export-scope.js";
import type {
  SupportedExportCategory,
} from "../types.js";

interface ValidateWallsBody {
  mappingRules?: MappingRule[];
  mappingFilePath?: string;
}

interface ValidateRoomsBody extends ValidateWallsBody { }

interface ValidateCombinedBody extends ValidateWallsBody {
  categories?: SupportedExportCategory[];
}

export function registerValidationRoutes(app: Express, revitClient: RevitClient): void {
  app.post("/api/validate/walls", async (req: Request, res: Response) => {
    const body = req.body as ValidateWallsBody;

    try {
      const rules = body.mappingRules ?? await loadMappingRules(body.mappingFilePath);
      const { lines, summary } = await buildCategoryLineResult(revitClient, "walls", rules);

      res.json({
        ok: true,
        data: {
          summary,
          lines,
        },
      });
    } catch (error) {
      res.status(500).json({
        ok: false,
        error: error instanceof Error ? error.message : "Wall validation failed",
      });
    }
  });

  app.post("/api/validate/rooms", async (req: Request, res: Response) => {
    const body = req.body as ValidateRoomsBody;

    try {
      const rules = body.mappingRules ?? await loadMappingRules(body.mappingFilePath);
      const { lines, summary } = await buildCategoryLineResult(revitClient, "rooms", rules);

      res.json({
        ok: true,
        data: {
          summary,
          lines,
        },
      });
    } catch (error) {
      res.status(500).json({
        ok: false,
        error: error instanceof Error ? error.message : "Room validation failed",
      });
    }
  });

  app.post("/api/validate/doors", async (req: Request, res: Response) => {
    const body = req.body as ValidateWallsBody;

    try {
      const rules = body.mappingRules ?? await loadMappingRules(body.mappingFilePath);
      const { lines, summary } = await buildCategoryLineResult(revitClient, "doors", rules);

      res.json({ ok: true, data: { lines, summary } });
    } catch (error) {
      res.status(500).json({
        ok: false,
        error: error instanceof Error ? error.message : "Door validation failed",
      });
    }
  });

  app.post("/api/validate/windows", async (req: Request, res: Response) => {
    const body = req.body as ValidateWallsBody;

    try {
      const rules = body.mappingRules ?? await loadMappingRules(body.mappingFilePath);
      const { lines, summary } = await buildCategoryLineResult(revitClient, "windows", rules);

      res.json({ ok: true, data: { lines, summary } });
    } catch (error) {
      res.status(500).json({
        ok: false,
        error: error instanceof Error ? error.message : "Window validation failed",
      });
    }
  });

  app.post("/api/validate/combined", async (req: Request, res: Response) => {
    const body = req.body as ValidateCombinedBody;

    try {
      const categories = normalizeExportCategories(body.categories);
      const rules = body.mappingRules ?? await loadMappingRules(body.mappingFilePath);
      const { results, lines, summary } = await buildCombinedCategoryLineResults(
        revitClient,
        categories,
        rules
      );

      res.json({
        ok: true,
        data: {
          categories,
          summary,
          lines,
          categorySummaries: Object.fromEntries(
            results.map((result) => [result.category, result.summary])
          ),
        },
      });
    } catch (error) {
      res.status(500).json({
        ok: false,
        error: error instanceof Error ? error.message : "Combined validation failed",
      });
    }
  });
}
