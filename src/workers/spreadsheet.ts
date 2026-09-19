/// <reference lib="webworker" />
import {
  readSpreadsheet,
  spreadsheetTemplate,
  SpreadsheetError,
  writeSpreadsheet,
} from "../domain/spreadsheet";
import type {
  SpreadsheetResult,
  SpreadsheetTask,
} from "../domain/spreadsheetTypes";

self.onmessage = async (event: MessageEvent<SpreadsheetTask>) => {
  try {
    const task = event.data;
    if (task.type === "import") {
      self.postMessage({
        type: "preview",
        preview: await readSpreadsheet(task.bytes),
      } satisfies SpreadsheetResult);
    } else {
      const bytes = await writeSpreadsheet(
        task.type === "template" ? spreadsheetTemplate() : task.project,
        task.type === "template",
      );
      self.postMessage({ type: "file", bytes } satisfies SpreadsheetResult, {
        transfer: [bytes.buffer],
      });
    }
  } catch (error) {
    self.postMessage({
      type: "error",
      issues:
        error instanceof SpreadsheetError
          ? error.issues
          : [
              {
                location: "Workbook",
                message:
                  error instanceof Error
                    ? error.message
                    : "The spreadsheet could not be processed. Try saving a fresh .xlsx copy.",
              },
            ],
    } satisfies SpreadsheetResult);
  }
};
