import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { readFile } from "node:fs/promises";
import {
  createSpreadsheet,
  parseSpreadsheet,
  readSpreadsheet,
  spreadsheetTemplate,
  SpreadsheetError,
  writeSpreadsheet,
} from "./spreadsheet";
import { testProject, holiday } from "./test-helpers";
import { createProject, type TimetableProject } from "./model";
import { buildCalendar } from "./calendar";
import { checkSpreadsheetArchive } from "./spreadsheetZip";

function meaning(p: TimetableProject) {
  return {
    name: p.name,
    cycleLength: p.cycleLength,
    rotationLabelStyle: p.rotationLabelStyle,
    initialRotationIndex: p.initialRotationIndex,
    setupComplete: p.setupComplete,
    setupStep: p.setupStep,
    academicYear: {
      ...p.academicYear,
      exclusions: p.academicYear.exclusions.map(({ id: _, ...rest }) => rest),
    },
    categories: p.periodCategories.map(({ id: _, ...rest }) => rest),
    subjects: p.subjects.map(({ id: _, ...rest }) => rest),
    periods: [...p.periods]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map(({ id: _, categoryId, sortOrder: __, ...rest }) => ({
        ...rest,
        category: p.periodCategories.find((c) => c.id === categoryId)?.name,
      })),
    entries: p.entries
      .map(({ id: _, periodId, subjectId, ...rest }) => ({
        ...rest,
        period: p.periods.find((x) => x.id === periodId)?.name,
        subject: p.subjects.findIndex((x) => x.id === subjectId),
      }))
      .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
  };
}
function issue(book: ExcelJS.Workbook, address: string) {
  try {
    parseSpreadsheet(book);
    throw new Error("Expected validation to fail");
  } catch (error) {
    expect(error).toBeInstanceOf(SpreadsheetError);
    expect(
      (error as SpreadsheetError).issues.some((i) => i.location === address),
    ).toBe(true);
  }
}

describe("SchoolCal spreadsheets", () => {
  it("imports an independently generated OOXML workbook with inline strings and date/time cells", async () => {
    const bytes = await readFile(
      new URL(
        "../../tests/fixtures/spreadsheet-openpyxl.xlsx",
        import.meta.url,
      ),
    );
    const { project, warnings } = await readSpreadsheet(
      Uint8Array.from(bytes).buffer,
    );
    expect(warnings).toEqual([]);
    expect(project).toMatchObject({
      name: "Independent workbook",
      setupComplete: true,
      setupStep: 6,
      cycleLength: 2,
      initialRotationIndex: 1,
      rotationLabelStyle: "letters",
    });
    expect(project.academicYear).toMatchObject({
      startDate: "2026-09-07",
      endDate: "2027-07-16",
      schoolWeekdays: [1, 3, 5],
    });
    expect(project.periods[0]).toMatchObject({
      startTime: "08:45",
      endTime: "09:35",
    });
    expect(project.entries[1]).toMatchObject({
      titleOverride: "Algebra",
      teacherOverride: "",
      roomOverride: "R02",
      notes: "Bring a ruler",
    });
    expect(project.academicYear.exclusions[0].resetRotationAfter).toBe(true);
  });
  it("round trips real XLSX bytes, custom categories, hidden lessons and explicit empty overrides with a new calendar identity", async () => {
    const p = testProject();
    p.rotationLabelStyle = "letters";
    p.initialRotationIndex = 1;
    p.setupStep = 6;
    p.academicYear.exclusions = [holiday("2026-10-19", "2026-10-23", true)];
    p.periodCategories.push({
      id: "special",
      name: "Study group",
      allowSubjects: true,
    });
    p.periods[0].categoryId = "special";
    p.subjects.push({
      ...p.subjects[0],
      id: "other-maths",
      teacher: "Mr White",
    });
    p.entries[0].subjectId = "other-maths";
    Object.assign(p.entries[1], {
      titleOverride: "Algebra",
      teacherOverride: "",
      roomOverride: "",
      notes: "Bring ruler\nRevision",
    });
    p.entries.push({
      id: "hidden-fixed",
      rotationIndex: 0,
      weekday: 1,
      periodId: "break",
      subjectId: "maths",
    });
    const original = structuredClone(p);
    const bytes = await writeSpreadsheet(p);
    const result = await readSpreadsheet(bytes.buffer);
    expect(meaning(result.project)).toEqual(meaning(p));
    expect(p).toEqual(original);
    expect(result.project.id).not.toBe(p.id);
    expect(result.warnings.some((w) => w.includes("hidden"))).toBe(true);
    expect(buildCalendar(result.project)).not.toBe(buildCalendar(p));
    result.project.subjects[0].name = "Changed";
    expect(p.subjects[0].name).toBe("Mathematics");
  });
  it("downloads an editable draft template with empty grids and useful examples", async () => {
    const result = await readSpreadsheet(
      (await writeSpreadsheet(spreadsheetTemplate(), true)).buffer,
    );
    expect(result.project.setupComplete).toBe(false);
    expect(result.project.periods.length).toBeGreaterThan(0);
    expect(result.project.subjects).toHaveLength(3);
    expect(result.project.entries).toEqual([]);
    expect(result.warnings).toContain(
      "This timetable will be saved as a draft.",
    );
  });
  it.each([0, 2, 3, 4, 5, 6])(
    "preserves unfinished setup at page %s",
    (step) => {
      const p = testProject();
      p.setupComplete = false;
      p.setupStep = step;
      expect(parseSpreadsheet(createSpreadsheet(p)).project.setupStep).toBe(
        step,
      );
    },
  );
  it("accepts completely empty timetables and demotes an incomplete completed file to setup", () => {
    const p = createProject();
    p.setupComplete = true;
    const result = parseSpreadsheet(createSpreadsheet(p));
    expect(result.project.setupComplete).toBe(false);
    expect(result.project.setupStep).toBe(0);
  });
  it("accepts Excel date/time cells, rich text, reordered settings and case-insensitive codes", async () => {
    const book = createSpreadsheet(testProject());
    book.getWorksheet("Settings")!.getCell("B3").value = new Date(
      "2026-09-07T00:00:00Z",
    );
    book.getWorksheet("Settings")!.getCell("B3").numFmt = "yyyy-mm-dd";
    book.getWorksheet("Periods")!.getCell("C2").value = 9 / 24;
    book.getWorksheet("Periods")!.getCell("C2").numFmt = "hh:mm";
    book.getWorksheet("Periods")!.getCell("D2").value = new Date(
      "1899-12-30T10:00:00Z",
    );
    book.getWorksheet("Periods")!.getCell("D2").numFmt = "hh:mm";
    book.getWorksheet("Subjects")!.getCell("B2").value = {
      richText: [{ text: "Math", font: { bold: true } }, { text: "ematics" }],
    };
    book.getWorksheet("Week 1")!.getCell("B2").value = " mathematics ";
    const settings = book.getWorksheet("Settings")!;
    const first = settings.getRow(2).values;
    settings.getRow(2).values = settings.getRow(5).values;
    settings.getRow(5).values = first;
    const result = await readSpreadsheet(
      new Uint8Array(await book.xlsx.writeBuffer()).buffer,
    );
    expect(result.project.academicYear.startDate).toBe("2026-09-07");
    expect(result.project.periods[0]).toMatchObject({
      startTime: "09:00",
      endTime: "10:00",
    });
    expect(result.project.subjects[0].name).toBe("Mathematics");
    expect(result.project.entries).toHaveLength(28);
  });
  it("exports formula-like text as literal strings", async () => {
    const p = testProject();
    p.name = '=HYPERLINK("https://example.com")';
    p.subjects[0].teacher = "+SUM(1,2)";
    const bytes = await writeSpreadsheet(p);
    const book = new ExcelJS.Workbook();
    await book.xlsx.load(bytes.buffer);
    expect(book.getWorksheet("Settings")!.getCell("B2").type).toBe(
      ExcelJS.ValueType.String,
    );
    expect((await readSpreadsheet(bytes.buffer)).project.name).toBe(p.name);
  });
  it.each([
    ["Settings", "B3", "2026-02-30"],
    ["Settings", "B4", "2026-01-01"],
    ["Settings", "B5", "Monday,Monday"],
    ["Settings", "B6", "Mars/Olympus"],
    ["Settings", "B7", 5],
    ["Settings", "B9", 3],
    ["Periods", "C2", "25:00"],
    ["Periods", "D2", "08:00"],
    ["Periods", "E2", "MISSING"],
    ["Subjects", "A3", "MATHEMATICS"],
    ["Subjects", "F2", "red"],
    ["Subjects", "B2", ""],
    ["Week 1", "B2", "MISSING"],
    ["Week 1", "A3", "PERIOD_1"],
    ["Week 1", "I2", "Lost lesson"],
    ["Week 1", "B2", { formula: "1+1", result: 2 }],
    ["Subjects", "B2", { text: "Maths", hyperlink: "https://example.com" }],
    ["Subjects", "A1", "Renamed header"],
    ["Settings", "A2", "Unknown setting"],
  ])("reports the exact invalid cell %s!%s", (sheet, cell, value) => {
    const book = createSpreadsheet(testProject());
    book.getWorksheet(sheet)!.getCell(cell).value = value as ExcelJS.CellValue;
    issue(book, `${sheet}!${cell}`);
  });
  it("rejects duplicate or orphan lesson details instead of dropping them", () => {
    const book = createSpreadsheet(testProject());
    const ws = book.getWorksheet("Lesson details")!;
    ws.getRow(2).values = [
      1,
      "Monday",
      "PERIOD_1",
      "No",
      "Lost title",
      "No",
      "",
      "No",
      "",
      "",
    ];
    issue(book, "Lesson details!D2");
    ws.getCell("D2").value = "Yes";
    ws.getRow(3).values = ws.getRow(2).values;
    issue(book, "Lesson details!A3");
    ws.getRow(3).values = [];
    book.getWorksheet("Week 1")!.getCell("B2").value = "";
    issue(book, "Lesson details!A2");
  });
  it("rejects missing sheets, unsupported versions and merged date cells", () => {
    const book = createSpreadsheet(testProject());
    book.removeWorksheet("Week 4");
    issue(book, "Week 4");
    const next = createSpreadsheet(testProject());
    next.getWorksheet("Read me")!.getCell("B1").value = "2";
    issue(next, "Read me!A1:B1");
    const merged = createSpreadsheet(testProject());
    const settings = merged.getWorksheet("Settings")!;
    settings.getCell("B3").value = new Date("2026-09-07T00:00:00Z");
    settings.mergeCells("B3:B4");
    issue(merged, "Settings!B3");
  });
  it("warns when extra sheets will not be imported and bounds the workbook size", () => {
    const book = createSpreadsheet(testProject());
    book.addWorksheet("My notes").getCell("A1").value = "Notes";
    expect(
      parseSpreadsheet(book).warnings.some((w) => w.includes("My notes")),
    ).toBe(true);
    book.getWorksheet("My notes")!.getCell("A1202").value = "Too many rows";
    expect(() => parseSpreadsheet(book)).toThrow("too many rows");
  });
  it("rejects corrupt files, oversized files and inflated ZIP declarations before parsing", async () => {
    expect(() => checkSpreadsheetArchive(new ArrayBuffer(5))).toThrow(
      "not an .xlsx",
    );
    expect(() => checkSpreadsheetArchive(new ArrayBuffer(2_000_001))).toThrow(
      "2 MB",
    );
    const bytes = await writeSpreadsheet(testProject());
    const view = new DataView(bytes.buffer);
    const end = bytes.byteLength - 22;
    const central = view.getUint32(end + 16, true);
    view.setUint32(central + 24, 20_000_001, true);
    await expect(readSpreadsheet(bytes.buffer)).rejects.toThrow(
      "expands beyond",
    );
  });
});
