import type { TimetableProject } from "./model";

export const SPREADSHEET_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
export const MAX_SPREADSHEET_BYTES = 2_000_000;
export interface SpreadsheetIssue {
  location: string;
  message: string;
}
export interface SpreadsheetPreview {
  project: TimetableProject;
  warnings: string[];
}
export type SpreadsheetTask =
  | { type: "template" }
  | { type: "export"; project: TimetableProject }
  | { type: "import"; bytes: ArrayBuffer };
export type SpreadsheetResult =
  | { type: "file"; bytes: Uint8Array<ArrayBuffer> }
  | { type: "preview"; preview: SpreadsheetPreview }
  | { type: "error"; issues: SpreadsheetIssue[] };
