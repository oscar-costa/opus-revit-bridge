import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import {
  buildTemplateRow,
  buildBudgetWorkbook,
  toOpusBudgetRows,
} from "../src/services/xlsx-exporter.js";
import { loadWorkbookTemplate } from "../src/services/export-storage.js";

describe("buildBudgetWorkbook", () => {
  it("converts normalized lines into Opus workbook rows", () => {
    const rows = toOpusBudgetRows([
      {
        conceptCode: "OP-001",
        description: "Concrete wall",
        unit: "m",
        quantity: 10,
        sourceCategory: "OST_Walls",
        sourceElementIds: [1, 2],
        levelName: "Level 1",
      },
    ]);

    expect(rows).toEqual([
      {
        conceptCode: "OP-001",
        description: "Concrete wall",
        unit: "m",
        quantity: 10,
        levelName: "Level 1",
        sourceCategory: "OST_Walls",
        sourceElementIds: "1, 2",
        importNotes: "Ready for Opus import review.",
      },
    ]);
  });

  it("maps Opus rows into template-configured columns", async () => {
    const template = await loadWorkbookTemplate();
    const [row] = toOpusBudgetRows([
      {
        conceptCode: "OP-001",
        description: "Concrete wall",
        unit: "m",
        quantity: 10,
        sourceCategory: "OST_Walls",
        sourceElementIds: [1, 2],
        levelName: "Level 1",
      },
    ]);

    const mapped = buildTemplateRow(row, template.importSheet.columns);

    expect(mapped).toMatchObject({
      column_1: "OP-001",
      column_2: "Concrete wall",
      column_3: "m",
      column_4: 10,
    });
  });

  it("returns a non-empty xlsx buffer", async () => {
    const template = await loadWorkbookTemplate();
    const result = await buildBudgetWorkbook([
      {
        conceptCode: "OP-001",
        description: "Concrete wall",
        unit: "m2",
        quantity: 10,
        sourceCategory: "OST_Walls",
        sourceElementIds: [1, 2],
        levelName: "Level 1",
      },
    ], undefined, template, {
      projectInfo: {
        name: "Sample Project",
        address: "Sample Address",
        clientName: "Sample Client",
        projectNumber: "PRJ-001",
      },
      exportScope: "Walls",
      generatedAt: "2026-04-03T12:00:00.000Z",
    });

    expect(result.fileName).toBe("opus-budget-lines.xlsx");
    expect(result.buffer.byteLength).toBeGreaterThan(0);

    const workbook = new ExcelJS.Workbook();
    const workbookInput = result.buffer as unknown as Parameters<
      typeof workbook.xlsx.load
    >[0];
    await workbook.xlsx.load(workbookInput);

    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual([
      "Project",
      "Opus Import",
      "Metadata",
      "Traceability",
    ]);
    expect(workbook.getWorksheet("Project")?.getRow(2).getCell(1).value).toBe(
      "Project Name"
    );
    expect(workbook.getWorksheet("Project")?.getRow(2).getCell(2).value).toBe(
      "Sample Project"
    );
    expect(workbook.getWorksheet("Project")?.getRow(6).getCell(2).value).toBe(
      "Walls"
    );
    expect(workbook.getWorksheet("Opus Import")?.getRow(1).getCell(1).value).toBe(
      "Clave"
    );
    expect(workbook.getWorksheet("Opus Import")?.getRow(1).getCell(2).value).toBe(
      "Descripción"
    );
    expect(workbook.getWorksheet("Opus Import")?.getRow(1).getCell(3).value).toBe(
      "Unidad"
    );
    expect(workbook.getWorksheet("Opus Import")?.getRow(2).getCell(3).value).toBe("m2");
    expect(workbook.getWorksheet("Opus Import")?.getRow(2).getCell(4).value).toBe(10);
    expect(workbook.getWorksheet("Opus Import")?.columnCount).toBe(4);
    expect(workbook.getWorksheet("Opus Import")?.getRow(2).getCell(1).value).toBe(
      "OP-001"
    );
    expect(workbook.getWorksheet("Traceability")?.getRow(1).getCell(1).value).toBe(
      "Clave"
    );
    expect(workbook.getWorksheet("Traceability")?.getRow(2).getCell(3).value).toBe(
      "Level 1"
    );
    expect(workbook.getWorksheet("Traceability")?.getRow(2).getCell(4).value).toBe(
      "OST_Walls"
    );
    expect(workbook.getWorksheet("Traceability")?.getRow(2).getCell(5).value).toBe(
      "1, 2"
    );
    expect(workbook.getWorksheet("Metadata")?.getRow(8).getCell(2).value).toBe(
      "Project"
    );
  });
});
