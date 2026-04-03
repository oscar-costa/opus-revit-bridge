import ExcelJS from "exceljs";
import type {
  ExportWorkbookContext,
  ExportWorkbookResult,
  NormalizedBudgetLine,
  OpusBudgetRow,
  WorkbookColumnTemplate,
  WorkbookTemplateConfig,
} from "../types.js";

export function toOpusBudgetRows(lines: NormalizedBudgetLine[]): OpusBudgetRow[] {
  return lines.map((line) => ({
    conceptCode: line.conceptCode,
    description: line.description,
    unit: line.unit,
    quantity: line.quantity,
    levelName: line.levelName ?? "",
    sourceCategory: line.sourceCategory,
    sourceElementIds: line.sourceElementIds.join(", "),
    importNotes:
      line.conceptCode === "UNMAPPED"
        ? "Missing mapping rule. Review before importing into Opus."
        : "Ready for Opus import review.",
  }));
}

function buildWorksheetColumns(columns: WorkbookColumnTemplate[]): Array<{
  header: string;
  key: string;
  width: number;
}> {
  return columns.map((column, index) => ({
    header: column.header,
    key: `column_${index + 1}`,
    width: column.width,
  }));
}

export function buildTemplateRow(
  row: OpusBudgetRow,
  columns: WorkbookColumnTemplate[]
): Record<string, string | number> {
  return Object.fromEntries(
    columns.map((column, index) => {
      const value = column.sourceKey
        ? row[column.sourceKey]
        : column.defaultValue ?? "";

      return [`column_${index + 1}`, value];
    })
  );
}

export async function buildBudgetWorkbook(
  lines: NormalizedBudgetLine[],
  fileName = "opus-budget-lines.xlsx",
  template: WorkbookTemplateConfig,
  context?: ExportWorkbookContext
): Promise<ExportWorkbookResult> {
  const workbook = new ExcelJS.Workbook();
  const generatedAt = context?.generatedAt ?? new Date().toISOString();

  if (template.projectSheet) {
    const projectSheet = workbook.addWorksheet(template.projectSheet.name);
    projectSheet.columns = [
      { header: "Field", key: "field", width: 24 },
      { header: "Value", key: "value", width: 60 },
    ];
    projectSheet.getRow(1).font = { bold: true };
    projectSheet.addRows([
      { field: "Project Name", value: context?.projectInfo?.name ?? "" },
      { field: "Project Number", value: context?.projectInfo?.projectNumber ?? "" },
      { field: "Client Name", value: context?.projectInfo?.clientName ?? "" },
      { field: "Project Address", value: context?.projectInfo?.address ?? "" },
      { field: "Export Scope", value: context?.exportScope ?? "Custom" },
      { field: "Generated At", value: generatedAt },
    ]);
  }

  const worksheet = workbook.addWorksheet(template.importSheet.name);
  const metadataSheet = workbook.addWorksheet(template.metadataSheet.name);
  const rows = toOpusBudgetRows(lines);

  worksheet.columns = buildWorksheetColumns(template.importSheet.columns);

  worksheet.getRow(1).font = { bold: true };
  if (template.importSheet.freezeHeader) {
    worksheet.views = [{ state: "frozen", ySplit: 1 }];
  }
  worksheet.autoFilter = `A1:${String.fromCharCode(64 + template.importSheet.columns.length)}1`;

  for (const row of rows) {
    worksheet.addRow(buildTemplateRow(row, template.importSheet.columns));
  }

  if (template.traceabilitySheet) {
    const traceabilitySheet = workbook.addWorksheet(template.traceabilitySheet.name);
    traceabilitySheet.columns = buildWorksheetColumns(template.traceabilitySheet.columns);
    traceabilitySheet.getRow(1).font = { bold: true };

    if (template.traceabilitySheet.freezeHeader) {
      traceabilitySheet.views = [{ state: "frozen", ySplit: 1 }];
    }

    traceabilitySheet.autoFilter =
      `A1:${String.fromCharCode(64 + template.traceabilitySheet.columns.length)}1`;

    for (const row of rows) {
      traceabilitySheet.addRow(
        buildTemplateRow(row, template.traceabilitySheet.columns)
      );
    }
  }

  metadataSheet.columns = [
    { header: "Field", key: "field", width: 24 },
    { header: "Value", key: "value", width: 60 },
  ];
  metadataSheet.getRow(1).font = { bold: true };
  metadataSheet.addRows([
    { field: "Workbook Type", value: template.workbookType },
    { field: "Line Count", value: String(lines.length) },
    {
      field: "Unmapped Count",
      value: String(lines.filter((line) => line.conceptCode === "UNMAPPED").length),
    },
    { field: "Generated At", value: generatedAt },
    { field: "Import Sheet", value: template.importSheet.name },
    {
      field: "Traceability Sheet",
      value: template.traceabilitySheet?.name ?? "Disabled",
    },
    {
      field: "Project Sheet",
      value: template.projectSheet?.name ?? "Disabled",
    },
  ]);

  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
  return { fileName, buffer };
}
