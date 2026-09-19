import { MAX_SPREADSHEET_BYTES } from "./spreadsheetTypes";

// Inspect the ZIP directory before the workbook library allocates worksheets.
export function checkSpreadsheetArchive(bytes: ArrayBuffer): void {
  if (bytes.byteLength > MAX_SPREADSHEET_BYTES)
    throw new Error("Choose a spreadsheet smaller than 2 MB.");
  const view = new DataView(bytes);
  let end = bytes.byteLength - 22;
  for (; end >= Math.max(0, bytes.byteLength - 65_557); end--)
    if (
      view.getUint32(end, true) === 0x06054b50 &&
      end + 22 + view.getUint16(end + 20, true) === bytes.byteLength
    )
      break;
  if (end < 0 || end < bytes.byteLength - 65_557)
    throw new Error(
      "This is not an .xlsx workbook. Download the SchoolCal template to get started.",
    );
  const count = view.getUint16(end + 10, true);
  let offset = view.getUint32(end + 16, true);
  if (view.getUint32(end + 4, true) !== 0 || count > 500 || offset >= end)
    throw new Error(
      "This workbook is too complex. Use the SchoolCal template without images or attachments.",
    );
  let expanded = 0;
  for (let i = 0; i < count; i++) {
    if (offset + 46 > end || view.getUint32(offset, true) !== 0x02014b50)
      throw new Error(
        "The workbook is damaged. Save a fresh .xlsx copy and try again.",
      );
    if (view.getUint16(offset + 8, true) & 1)
      throw new Error("Remove the workbook password before importing it.");
    expanded += view.getUint32(offset + 24, true);
    if (expanded > 20_000_000)
      throw new Error(
        "This workbook expands beyond 20 MB. Use the SchoolCal template without images or attachments.",
      );
    offset +=
      46 +
      view.getUint16(offset + 28, true) +
      view.getUint16(offset + 30, true) +
      view.getUint16(offset + 32, true);
  }
  if (offset !== end)
    throw new Error(
      "The workbook is damaged or uses an unsupported ZIP format.",
    );
}
