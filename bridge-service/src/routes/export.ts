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
import {
  buildStampedFileName,
  loadExportConfig,
  loadWorkbookTemplate,
  saveWorkbookBuffer,
} from "../services/export-storage.js";
import {
  formatExportScope,
  normalizeExportCategories,
} from "../services/export-scope.js";
import { buildBudgetWorkbook } from "../services/xlsx-exporter.js";
import type {
  ProjectInfo,
  SupportedExportCategory,
  NormalizedBudgetLine,
} from "../types.js";

interface ExportBody {
  lines?: NormalizedBudgetLine[];
  fileName?: string;
  templateConfigPath?: string;
  projectInfo?: ProjectInfo;
  exportScope?: string;
}

interface ExportWallsBody {
  fileName?: string;
  mappingRules?: MappingRule[];
  mappingFilePath?: string;
  allowUnmapped?: boolean;
  exportConfigPath?: string;
  outputDirectory?: string;
  templateConfigPath?: string;
}

interface ExportRoomsBody extends ExportWallsBody { }

interface ExportCombinedBody extends ExportWallsBody {
  categories?: SupportedExportCategory[];
}

async function getProjectInfo(revitClient: RevitClient): Promise<ProjectInfo> {
  return revitClient.send<ProjectInfo>({
    method: "get_project_info",
    params: {},
  });
}

export function registerExportRoutes(app: Express, revitClient: RevitClient): void {
  app.post("/api/export/xlsx", async (req: Request, res: Response) => {
    const body = req.body as ExportBody;
    const lines = body.lines ?? [];

    try {
      const template = await loadWorkbookTemplate(body.templateConfigPath);
      const workbook = await buildBudgetWorkbook(lines, body.fileName, template, {
        projectInfo: body.projectInfo,
        exportScope: body.exportScope ?? "Custom",
      });

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${workbook.fileName}"`
      );
      res.send(workbook.buffer);
    } catch (error) {
      res.status(500).json({
        ok: false,
        error: error instanceof Error ? error.message : "Workbook export failed",
      });
    }
  });

  app.post("/api/export/combined/xlsx", async (req: Request, res: Response) => {
    const body = req.body as ExportCombinedBody;

    try {
      const categories = normalizeExportCategories(body.categories);
      const rules = body.mappingRules ?? await loadMappingRules(body.mappingFilePath);
      const exportConfig = await loadExportConfig(body.exportConfigPath);
      const template = await loadWorkbookTemplate(
        body.templateConfigPath ?? exportConfig.templateConfigPath
      );
      const projectInfo = await getProjectInfo(revitClient);
      const { lines, summary } = await buildCombinedCategoryLineResults(
        revitClient,
        categories,
        rules
      );

      if (summary.unmappedLines > 0 && !body.allowUnmapped) {
        res.status(400).json({
          ok: false,
          error:
            "Export blocked because some lines are unmapped. Pass allowUnmapped=true only for review exports.",
          data: summary,
        });
        return;
      }

      const workbook = await buildBudgetWorkbook(
        lines,
        body.fileName ?? "opus-quantity-export.xlsx",
        template,
        {
          projectInfo,
          exportScope: formatExportScope(categories),
        }
      );

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${workbook.fileName}"`
      );
      res.setHeader("X-Opus-Unmapped-Count", String(summary.unmappedLines));
      res.send(workbook.buffer);
    } catch (error) {
      res.status(500).json({
        ok: false,
        error: error instanceof Error ? error.message : "Combined workbook export failed",
      });
    }
  });

  app.post("/api/export/combined/file", async (req: Request, res: Response) => {
    const body = req.body as ExportCombinedBody;

    try {
      const categories = normalizeExportCategories(body.categories);
      const rules = body.mappingRules ?? await loadMappingRules(body.mappingFilePath);
      const exportConfig = await loadExportConfig(body.exportConfigPath);
      const template = await loadWorkbookTemplate(
        body.templateConfigPath ?? exportConfig.templateConfigPath
      );
      const projectInfo = await getProjectInfo(revitClient);
      const { lines, summary } = await buildCombinedCategoryLineResults(
        revitClient,
        categories,
        rules
      );

      if (summary.unmappedLines > 0 && !body.allowUnmapped) {
        res.status(400).json({
          ok: false,
          error:
            "Export blocked because some lines are unmapped. Pass allowUnmapped=true only for review exports.",
          data: summary,
        });
        return;
      }

      const fileName = body.fileName ?? buildStampedFileName(exportConfig.fileNamePrefix, "combined");
      const workbook = await buildBudgetWorkbook(lines, fileName, template, {
        projectInfo,
        exportScope: formatExportScope(categories),
      });
      const savedWorkbook = await saveWorkbookBuffer(
        workbook.fileName,
        workbook.buffer,
        body.outputDirectory ?? exportConfig.outputDirectory
      );

      res.json({
        ok: true,
        data: {
          fileName: savedWorkbook.fileName,
          outputPath: savedWorkbook.outputPath,
          unmappedLines: summary.unmappedLines,
          totalLines: summary.totalLines,
          categories,
        },
      });
    } catch (error) {
      res.status(500).json({
        ok: false,
        error: error instanceof Error ? error.message : "Combined file export failed",
      });
    }
  });

  app.post("/api/export/walls/xlsx", async (req: Request, res: Response) => {
    const body = req.body as ExportWallsBody;

    try {
      const rules = body.mappingRules ?? await loadMappingRules(body.mappingFilePath);
      const exportConfig = await loadExportConfig(body.exportConfigPath);
      const template = await loadWorkbookTemplate(
        body.templateConfigPath ?? exportConfig.templateConfigPath
      );
      const projectInfo = await getProjectInfo(revitClient);
      const { lines, summary } = await buildCategoryLineResult(revitClient, "walls", rules);

      if (summary.unmappedLines > 0 && !body.allowUnmapped) {
        res.status(400).json({
          ok: false,
          error:
            "Export blocked because some lines are unmapped. Pass allowUnmapped=true only for review exports.",
          data: summary,
        });
        return;
      }

      const workbook = await buildBudgetWorkbook(
        lines,
        body.fileName ?? "opus-wall-budget-lines.xlsx",
        template,
        { projectInfo, exportScope: "Walls" }
      );

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${workbook.fileName}"`
      );
      res.setHeader("X-Opus-Unmapped-Count", String(summary.unmappedLines));
      res.send(workbook.buffer);
    } catch (error) {
      res.status(500).json({
        ok: false,
        error: error instanceof Error ? error.message : "Wall workbook export failed",
      });
    }
  });

  app.post("/api/export/walls/file", async (req: Request, res: Response) => {
    const body = req.body as ExportWallsBody;

    try {
      const rules = body.mappingRules ?? await loadMappingRules(body.mappingFilePath);
      const exportConfig = await loadExportConfig(body.exportConfigPath);
      const template = await loadWorkbookTemplate(
        body.templateConfigPath ?? exportConfig.templateConfigPath
      );
      const projectInfo = await getProjectInfo(revitClient);
      const { lines, summary } = await buildCategoryLineResult(revitClient, "walls", rules);

      if (summary.unmappedLines > 0 && !body.allowUnmapped) {
        res.status(400).json({
          ok: false,
          error:
            "Export blocked because some lines are unmapped. Pass allowUnmapped=true only for review exports.",
          data: summary,
        });
        return;
      }

      const fileName = body.fileName ?? buildStampedFileName(exportConfig.fileNamePrefix, "walls");
      const workbook = await buildBudgetWorkbook(lines, fileName, template, {
        projectInfo,
        exportScope: "Walls",
      });
      const savedWorkbook = await saveWorkbookBuffer(
        workbook.fileName,
        workbook.buffer,
        body.outputDirectory ?? exportConfig.outputDirectory
      );

      res.json({
        ok: true,
        data: {
          fileName: savedWorkbook.fileName,
          outputPath: savedWorkbook.outputPath,
          unmappedLines: summary.unmappedLines,
          totalLines: summary.totalLines,
        },
      });
    } catch (error) {
      res.status(500).json({
        ok: false,
        error: error instanceof Error ? error.message : "Wall file export failed",
      });
    }
  });

  app.post("/api/export/rooms/xlsx", async (req: Request, res: Response) => {
    const body = req.body as ExportRoomsBody;

    try {
      const rules = body.mappingRules ?? await loadMappingRules(body.mappingFilePath);
      const exportConfig = await loadExportConfig(body.exportConfigPath);
      const template = await loadWorkbookTemplate(
        body.templateConfigPath ?? exportConfig.templateConfigPath
      );
      const projectInfo = await getProjectInfo(revitClient);
      const { lines, summary } = await buildCategoryLineResult(revitClient, "rooms", rules);

      if (summary.unmappedLines > 0 && !body.allowUnmapped) {
        res.status(400).json({
          ok: false,
          error:
            "Export blocked because some lines are unmapped. Pass allowUnmapped=true only for review exports.",
          data: summary,
        });
        return;
      }

      const workbook = await buildBudgetWorkbook(
        lines,
        body.fileName ?? "opus-room-budget-lines.xlsx",
        template,
        { projectInfo, exportScope: "Rooms" }
      );

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${workbook.fileName}"`
      );
      res.setHeader("X-Opus-Unmapped-Count", String(summary.unmappedLines));
      res.send(workbook.buffer);
    } catch (error) {
      res.status(500).json({
        ok: false,
        error: error instanceof Error ? error.message : "Room workbook export failed",
      });
    }
  });

  app.post("/api/export/rooms/file", async (req: Request, res: Response) => {
    const body = req.body as ExportRoomsBody;

    try {
      const rules = body.mappingRules ?? await loadMappingRules(body.mappingFilePath);
      const exportConfig = await loadExportConfig(body.exportConfigPath);
      const template = await loadWorkbookTemplate(
        body.templateConfigPath ?? exportConfig.templateConfigPath
      );
      const projectInfo = await getProjectInfo(revitClient);
      const { lines, summary } = await buildCategoryLineResult(revitClient, "rooms", rules);

      if (summary.unmappedLines > 0 && !body.allowUnmapped) {
        res.status(400).json({
          ok: false,
          error:
            "Export blocked because some lines are unmapped. Pass allowUnmapped=true only for review exports.",
          data: summary,
        });
        return;
      }

      const fileName = body.fileName ?? buildStampedFileName(exportConfig.fileNamePrefix, "rooms");
      const workbook = await buildBudgetWorkbook(lines, fileName, template, {
        projectInfo,
        exportScope: "Rooms",
      });
      const savedWorkbook = await saveWorkbookBuffer(
        workbook.fileName,
        workbook.buffer,
        body.outputDirectory ?? exportConfig.outputDirectory
      );

      res.json({
        ok: true,
        data: {
          fileName: savedWorkbook.fileName,
          outputPath: savedWorkbook.outputPath,
          unmappedLines: summary.unmappedLines,
          totalLines: summary.totalLines,
        },
      });
    } catch (error) {
      res.status(500).json({
        ok: false,
        error: error instanceof Error ? error.message : "Room file export failed",
      });
    }
  });

  app.post("/api/export/doors/xlsx", async (req: Request, res: Response) => {
    const body = req.body as ExportWallsBody;

    try {
      const rules = body.mappingRules ?? await loadMappingRules(body.mappingFilePath);
      const exportConfig = await loadExportConfig(body.exportConfigPath);
      const template = await loadWorkbookTemplate(
        body.templateConfigPath ?? exportConfig.templateConfigPath
      );
      const projectInfo = await getProjectInfo(revitClient);
      const { lines, summary } = await buildCategoryLineResult(revitClient, "doors", rules);

      if (summary.unmappedLines > 0 && !body.allowUnmapped) {
        res.status(400).json({ ok: false, error: "Export blocked because some lines are unmapped. Pass allowUnmapped=true only for review exports.", data: summary });
        return;
      }

      const workbook = await buildBudgetWorkbook(
        lines,
        body.fileName ?? "opus-door-budget-lines.xlsx",
        template,
        { projectInfo, exportScope: "Doors" }
      );

      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="${workbook.fileName}"`);
      res.setHeader("X-Opus-Unmapped-Count", String(summary.unmappedLines));
      res.send(workbook.buffer);
    } catch (error) {
      res.status(500).json({ ok: false, error: error instanceof Error ? error.message : "Door workbook export failed" });
    }
  });

  app.post("/api/export/doors/file", async (req: Request, res: Response) => {
    const body = req.body as ExportWallsBody;

    try {
      const rules = body.mappingRules ?? await loadMappingRules(body.mappingFilePath);
      const exportConfig = await loadExportConfig(body.exportConfigPath);
      const template = await loadWorkbookTemplate(
        body.templateConfigPath ?? exportConfig.templateConfigPath
      );
      const projectInfo = await getProjectInfo(revitClient);
      const { lines, summary } = await buildCategoryLineResult(revitClient, "doors", rules);

      if (summary.unmappedLines > 0 && !body.allowUnmapped) {
        res.status(400).json({ ok: false, error: "Export blocked because some lines are unmapped. Pass allowUnmapped=true only for review exports.", data: summary });
        return;
      }

      const fileName = body.fileName ?? buildStampedFileName(exportConfig.fileNamePrefix, "doors");
      const workbook = await buildBudgetWorkbook(lines, fileName, template, {
        projectInfo,
        exportScope: "Doors",
      });
      const savedWorkbook = await saveWorkbookBuffer(
        workbook.fileName,
        workbook.buffer,
        body.outputDirectory ?? exportConfig.outputDirectory
      );

      res.json({
        ok: true,
        data: {
          fileName: savedWorkbook.fileName,
          outputPath: savedWorkbook.outputPath,
          unmappedLines: summary.unmappedLines,
          totalLines: summary.totalLines,
        },
      });
    } catch (error) {
      res.status(500).json({ ok: false, error: error instanceof Error ? error.message : "Door file export failed" });
    }
  });

  app.post("/api/export/windows/xlsx", async (req: Request, res: Response) => {
    const body = req.body as ExportWallsBody;

    try {
      const rules = body.mappingRules ?? await loadMappingRules(body.mappingFilePath);
      const exportConfig = await loadExportConfig(body.exportConfigPath);
      const template = await loadWorkbookTemplate(
        body.templateConfigPath ?? exportConfig.templateConfigPath
      );
      const projectInfo = await getProjectInfo(revitClient);
      const { lines, summary } = await buildCategoryLineResult(revitClient, "windows", rules);

      if (summary.unmappedLines > 0 && !body.allowUnmapped) {
        res.status(400).json({ ok: false, error: "Export blocked because some lines are unmapped. Pass allowUnmapped=true only for review exports.", data: summary });
        return;
      }

      const workbook = await buildBudgetWorkbook(
        lines,
        body.fileName ?? "opus-window-budget-lines.xlsx",
        template,
        { projectInfo, exportScope: "Windows" }
      );

      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="${workbook.fileName}"`);
      res.setHeader("X-Opus-Unmapped-Count", String(summary.unmappedLines));
      res.send(workbook.buffer);
    } catch (error) {
      res.status(500).json({ ok: false, error: error instanceof Error ? error.message : "Window workbook export failed" });
    }
  });

  app.post("/api/export/windows/file", async (req: Request, res: Response) => {
    const body = req.body as ExportWallsBody;

    try {
      const rules = body.mappingRules ?? await loadMappingRules(body.mappingFilePath);
      const exportConfig = await loadExportConfig(body.exportConfigPath);
      const template = await loadWorkbookTemplate(
        body.templateConfigPath ?? exportConfig.templateConfigPath
      );
      const projectInfo = await getProjectInfo(revitClient);
      const { lines, summary } = await buildCategoryLineResult(revitClient, "windows", rules);

      if (summary.unmappedLines > 0 && !body.allowUnmapped) {
        res.status(400).json({ ok: false, error: "Export blocked because some lines are unmapped. Pass allowUnmapped=true only for review exports.", data: summary });
        return;
      }

      const fileName = body.fileName ?? buildStampedFileName(exportConfig.fileNamePrefix, "windows");
      const workbook = await buildBudgetWorkbook(lines, fileName, template, {
        projectInfo,
        exportScope: "Windows",
      });
      const savedWorkbook = await saveWorkbookBuffer(
        workbook.fileName,
        workbook.buffer,
        body.outputDirectory ?? exportConfig.outputDirectory
      );

      res.json({
        ok: true,
        data: {
          fileName: savedWorkbook.fileName,
          outputPath: savedWorkbook.outputPath,
          unmappedLines: summary.unmappedLines,
          totalLines: summary.totalLines,
        },
      });
    } catch (error) {
      res.status(500).json({ ok: false, error: error instanceof Error ? error.message : "Window file export failed" });
    }
  });
}
