import type {
  SpreadsheetResult,
  SpreadsheetTask,
} from "../domain/spreadsheetTypes";

export function runSpreadsheetTask(
  task: SpreadsheetTask,
  signal: AbortSignal,
): Promise<SpreadsheetResult> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException("Cancelled", "AbortError"));
      return;
    }
    const worker = new Worker(
      new URL("../workers/spreadsheet.ts", import.meta.url),
      { type: "module" },
    );
    const finish = () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", abort);
      worker.terminate();
    };
    const abort = () => {
      finish();
      reject(new DOMException("Cancelled", "AbortError"));
    };
    const timer = setTimeout(() => {
      finish();
      reject(
        new Error(
          "The workbook took too long to process. Remove extra sheets, images and formatting, then try again.",
        ),
      );
    }, 30_000);
    signal.addEventListener("abort", abort, { once: true });
    worker.onmessage = (event: MessageEvent<SpreadsheetResult>) => {
      finish();
      resolve(event.data);
    };
    worker.onerror = () => {
      finish();
      reject(
        new Error(
          "Spreadsheet tools could not start. Reload the app and try again.",
        ),
      );
    };
    try {
      worker.postMessage(task, task.type === "import" ? [task.bytes] : []);
    } catch (error) {
      finish();
      reject(error);
    }
  });
}
