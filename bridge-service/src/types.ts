export interface RevitRequest {
  method: string;
  params?: Record<string, unknown>;
}

export interface RevitResponse<T = unknown> {
  result: T | null;
  error: string | null;
}

export interface ProjectInfo {
  name: string;
  address: string;
  clientName: string;
  projectNumber: string;
}

export interface WallInfo {
  id: number;
  typeName: string;
  length: number;
  baseLevel: string;
  topConstraint: string;
}

export interface GetWallsResponse {
  walls: WallInfo[];
}

export interface RoomInfo {
  id: number;
  name: string;
  number: string;
  area: number;
  level: string;
}

export interface GetRoomsResponse {
  rooms: RoomInfo[];
}

export interface CategoryElementInfo {
  id: number;
  name: string;
  typeName: string;
  level: string;
}

export interface GetElementsByCategoryResponse {
  category: string;
  elements: CategoryElementInfo[];
}

export interface MappingConfig {
  version: number;
  rules: Array<{
    sourceCategory: string;
    conceptCode: string;
    description?: string;
    unit?: string;
  }>;
}

export interface ExportConfig {
  version: number;
  outputDirectory: string;
  fileNamePrefix: string;
  templateConfigPath?: string;
}

export interface WorkbookColumnTemplate {
  header: string;
  sourceKey?: keyof OpusBudgetRow;
  defaultValue?: string | number;
  width: number;
}

export interface WorkbookSheetTemplate {
  name: string;
  freezeHeader?: boolean;
  columns?: WorkbookColumnTemplate[];
}

export interface WorkbookTemplateConfig {
  version: number;
  workbookType: string;
  projectSheet?: WorkbookSheetTemplate;
  importSheet: WorkbookSheetTemplate & {
    columns: WorkbookColumnTemplate[];
  };
  metadataSheet: WorkbookSheetTemplate;
  traceabilitySheet?: WorkbookSheetTemplate & {
    columns: WorkbookColumnTemplate[];
  };
}

export interface ValidationIssue {
  code: string;
  message: string;
  sourceCategory: string;
  sourceElementIds: number[];
}

export interface ValidationSummary {
  totalLines: number;
  unmappedLines: number;
  totalQuantity: number;
  issues: ValidationIssue[];
}

export type SupportedExportCategory = "walls" | "rooms" | "doors" | "windows";

export interface NormalizedBudgetLine {
  conceptCode: string;
  description: string;
  unit: string;
  quantity: number;
  sourceCategory: string;
  sourceElementIds: number[];
  levelName?: string;
}

export interface OpusBudgetRow {
  conceptCode: string;
  description: string;
  unit: string;
  quantity: number;
  levelName: string;
  sourceCategory: string;
  sourceElementIds: string;
  importNotes: string;
}

export interface ExportWorkbookResult {
  fileName: string;
  buffer: Buffer;
}

export interface ExportWorkbookContext {
  projectInfo?: ProjectInfo;
  exportScope?: string;
  generatedAt?: string;
}

export interface SavedWorkbookResult extends ExportWorkbookResult {
  outputPath: string;
}
