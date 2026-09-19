import ExcelJS, { type Cell, type Worksheet } from "exceljs";
import {
  COLOURS,
  createProject,
  DAY_NAMES,
  newId,
  sortedPeriods,
  WEEKDAYS,
  type TimetableProject,
} from "./model";
import { standardPeriods } from "./fixture";
import { parseProject, serializeProject } from "./persistence";
import { daysBetween, validDate, validTime, validTimezone } from "./dates";
import { validateProject } from "./validation";
import { checkSpreadsheetArchive } from "./spreadsheetZip";
import type { SpreadsheetIssue, SpreadsheetPreview } from "./spreadsheetTypes";

export const SHEET_HEADERS = {
  Settings: ["Setting", "Value"],
  Periods: ["Code", "Name", "Start time", "End time", "Category"],
  Subjects: ["Code", "Name", "Short name", "Teacher", "Room", "Colour"],
  Holidays: ["Name", "First day", "Last day", "Reset rotation"],
  Categories: ["Code", "Name", "Allow subjects"],
  "Lesson details": [
    "Week",
    "Day",
    "Period",
    "Override title",
    "Title",
    "Override teacher",
    "Teacher",
    "Override room",
    "Room",
    "Notes",
  ],
};
const WEEK_HEADERS = ["Period", ...WEEKDAYS.map((d) => DAY_NAMES[d])];
const SETUP_PAGES = [
  "School year & rotation",
  "School year & rotation",
  "Holidays & days off",
  "Lesson times",
  "Subjects",
  "Build timetable",
  "Lesson preview",
];
const SETTINGS = [
  "Timetable name",
  "First school day",
  "Last school day",
  "School days",
  "Time zone",
  "Weeks in rotation",
  "Week labels",
  "First week",
  "Setup status",
  "Resume setup at",
];
const normal = (text: string) => text.trim().toLowerCase();
const yesNo = (value: boolean) => (value ? "Yes" : "No");

export class SpreadsheetError extends Error {
  constructor(public issues: SpreadsheetIssue[]) {
    super(issues[0]?.message || "This workbook could not be read.");
  }
}

function codes(records: { id: string; name: string }[]) {
  const used = new Set<string>();
  return new Map(
    records.map((record, i) => {
      const stem =
        record.name
          .normalize("NFKD")
          .replace(/[^a-zA-Z0-9]+/g, "_")
          .replace(/^_|_$/g, "")
          .slice(0, 40)
          .toUpperCase() || `ITEM_${i + 1}`;
      let code = stem,
        suffix = 2;
      while (used.has(code)) code = `${stem}_${suffix++}`;
      used.add(code);
      return [record.id, code];
    }),
  );
}

export function spreadsheetTemplate(): TimetableProject {
  return {
    ...createProject(),
    name: "My timetable",
    cycleLength: 2,
    periods: standardPeriods(),
    subjects: ["Mathematics", "English", "Science"].map((name, i) => ({
      id: newId(),
      name,
      colour: COLOURS[i],
    })),
  };
}

export function createSpreadsheet(
  p: TimetableProject,
  template = false,
): ExcelJS.Workbook {
  const book = new ExcelJS.Workbook();
  book.creator = "SchoolCal";
  const sheet = (
    name: string,
    headers: string[],
    rows: (string | number | boolean)[][],
    widths?: number[],
  ) => {
    const ws = book.addWorksheet(name, {
      views: [
        {
          state: "frozen",
          ySplit: 1,
          xSplit: name.startsWith("Week ") ? 1 : 0,
        },
      ],
    });
    ws.addRow(headers);
    ws.addRows(rows);
    ws.columns.forEach((column, i) => {
      column.width = widths?.[i] ?? 24;
      column.numFmt = "@";
    });
    ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    ws.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF295DA8" },
    };
    ws.getRow(1).height = 26;
    ws.eachRow((row, number) => {
      row.alignment = { vertical: "middle", wrapText: true };
      if (number > 1) row.height = 30;
    });
    ws.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: Math.max(2, rows.length + 1), column: headers.length },
    };
    return ws;
  };
  const readme = sheet(
    "Read me",
    ["SchoolCal spreadsheet", "1"],
    [
      [
        "Start here",
        template
          ? "Replace the example subjects and check the example lesson times. The week grids start empty."
          : "This workbook contains the active timetable. Importing it adds a separate timetable; saved work is kept.",
      ],
      [
        "1. Settings",
        "Enter your school dates as YYYY-MM-DD, school days, time zone and rotation. Dates may be left empty for an unfinished timetable.",
      ],
      [
        "2. Periods and Subjects",
        "Edit these lists first. Codes must be unique letters, numbers, underscores or hyphens. Keep a code unchanged when renaming an existing item.",
      ],
      [
        "3. Week grids",
        "Put a subject code in each lesson cell, or leave it empty. Copy and paste to repeat lessons. The Period column uses codes from Periods.",
      ],
      [
        "Four week tabs",
        "Week 1 = Week A, Week 2 = Week B, and so on. Weeks and days outside your settings are kept but do not appear in your calendar.",
      ],
      [
        "Holidays",
        "Add days off and choose Yes or No to reset the rotation after each break.",
      ],
      [
        "Categories",
        "Allow subjects = No makes a fixed period such as registration or lunch. Any subjects stored there are kept, ready to use if you change it back to Yes.",
      ],
      [
        "Lesson details (optional)",
        "Add a week, day and period for a filled grid cell. Set an Override column to Yes to replace that subject default. Yes with an empty Teacher or Room deliberately clears it. Notes are optional.",
      ],
      [
        "Google Sheets",
        "Open this .xlsx file in Google Sheets. When finished, choose File → Download → Microsoft Excel (.xlsx), then import that file in SchoolCal.",
      ],
      [
        "Before importing",
        "Keep the sheet names and headings. Use values, not formulas or merged cells. The preview identifies cells to fix before saving. This format does not import arbitrary school spreadsheets.",
      ],
      [
        "Limits",
        "2 MB file; 40 periods; 100 subjects; 40 categories; 200 holidays. Add up to four weeks of lessons. Blank rows are ignored.",
      ],
      [
        "Backups",
        "Keep a JSON backup for an exact copy of the original timetable identity. A spreadsheet import receives a new identity. Subject and period order follows the spreadsheet rows.",
      ],
    ],
    [28, 105],
  );
  readme.autoFilter = undefined;
  readme.eachRow((row, i) => {
    if (i > 1) row.height = 48;
  });
  const settings = sheet(
    "Settings",
    SHEET_HEADERS.Settings,
    SETTINGS.map((key, i) => [
      key,
      [
        p.name,
        p.academicYear.startDate,
        p.academicYear.endDate,
        WEEKDAYS.filter((d) => p.academicYear.schoolWeekdays.includes(d))
          .map((d) => DAY_NAMES[d])
          .join(", "),
        p.academicYear.timezone,
        p.cycleLength,
        p.rotationLabelStyle === "letters" ? "Letters" : "Numbers",
        p.initialRotationIndex + 1,
        p.setupComplete ? "Complete" : "In progress",
        SETUP_PAGES[p.setupStep],
      ][i],
    ]),
    [30, 70],
  );
  const categoryCodes = codes(p.periodCategories),
    periodCodes = codes(p.periods),
    subjectCodes = codes(p.subjects);
  const periods = sortedPeriods(p);
  sheet(
    "Periods",
    SHEET_HEADERS.Periods,
    periods.map((period) => [
      periodCodes.get(period.id)!,
      period.name,
      period.startTime,
      period.endTime,
      categoryCodes.get(period.categoryId)!,
    ]),
  );
  sheet(
    "Subjects",
    SHEET_HEADERS.Subjects,
    p.subjects.map((subject) => [
      subjectCodes.get(subject.id)!,
      subject.name,
      subject.shortName ?? "",
      subject.teacher ?? "",
      subject.room ?? "",
      subject.colour,
    ]),
  );
  book.definedNames.add("'Subjects'!$A$2:$A$101", "SubjectCodes");
  book.definedNames.add("'Periods'!$A$2:$A$41", "PeriodCodes");
  book.definedNames.add("'Categories'!$A$2:$A$41", "CategoryCodes");
  const list = (cell: Cell, values: string) => {
    cell.dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: [values],
      showErrorMessage: true,
      errorTitle: "Choose a listed value",
      error: "Use a value from the list, or leave this cell empty.",
    };
  };
  const entries = new Map(
    p.entries.map((e) => [`${e.rotationIndex}:${e.periodId}:${e.weekday}`, e]),
  );
  for (let week = 0; week < 4; week++) {
    const ws = sheet(
      `Week ${week + 1}`,
      WEEK_HEADERS,
      periods.map((period) => [
        periodCodes.get(period.id)!,
        ...WEEKDAYS.map((day) => {
          const entry = entries.get(`${week}:${period.id}:${day}`);
          return entry ? subjectCodes.get(entry.subjectId)! : "";
        }),
      ]),
    );
    for (let row = 2; row <= 41; row++) {
      list(ws.getCell(row, 1), "PeriodCodes");
      for (let col = 2; col <= 8; col++) {
        const cell = ws.getCell(row, col);
        list(cell, "SubjectCodes");
        if (
          week >= p.cycleLength ||
          !p.academicYear.schoolWeekdays.includes(WEEKDAYS[col - 2])
        )
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFEDEFF2" },
          };
      }
    }
  }
  const holidays = sheet(
    "Holidays",
    SHEET_HEADERS.Holidays,
    p.academicYear.exclusions.map((holiday) => [
      holiday.name,
      holiday.startDate,
      holiday.endDate,
      yesNo(holiday.resetRotationAfter),
    ]),
  );
  const categories = sheet(
    "Categories",
    SHEET_HEADERS.Categories,
    p.periodCategories.map((category) => [
      categoryCodes.get(category.id)!,
      category.name,
      yesNo(category.allowSubjects),
    ]),
  );
  const details = sheet(
    "Lesson details",
    SHEET_HEADERS["Lesson details"],
    p.entries
      .filter(
        (e) =>
          e.titleOverride !== undefined ||
          e.teacherOverride !== undefined ||
          e.roomOverride !== undefined ||
          e.notes !== undefined,
      )
      .map((e) => [
        e.rotationIndex + 1,
        DAY_NAMES[e.weekday],
        periodCodes.get(e.periodId)!,
        yesNo(e.titleOverride !== undefined),
        e.titleOverride ?? "",
        yesNo(e.teacherOverride !== undefined),
        e.teacherOverride ?? "",
        yesNo(e.roomOverride !== undefined),
        e.roomOverride ?? "",
        e.notes ?? "",
      ]),
  );
  for (let row = 2; row <= 41; row++) {
    list(categories.getCell(row, 3), '"Yes,No"');
    list(book.getWorksheet("Periods")!.getCell(row, 5), "CategoryCodes");
  }
  for (let row = 2; row <= 201; row++)
    list(holidays.getCell(row, 4), '"Yes,No"');
  for (let row = 2; row <= Math.max(details.rowCount, 41); row++) {
    for (const col of [4, 6, 8]) list(details.getCell(row, col), '"Yes,No"');
    list(details.getCell(row, 3), "PeriodCodes");
    list(
      details.getCell(row, 2),
      `"${WEEKDAYS.map((d) => DAY_NAMES[d]).join(",")}"`,
    );
  }
  list(settings.getCell("B8"), '"Letters,Numbers"');
  list(settings.getCell("B10"), '"In progress,Complete"');
  list(settings.getCell("B11"), `"${[...new Set(SETUP_PAGES)].join(",")}"`);
  return book;
}

export async function writeSpreadsheet(
  p: TimetableProject,
  template = false,
): Promise<Uint8Array<ArrayBuffer>> {
  return new Uint8Array(
    await createSpreadsheet(p, template).xlsx.writeBuffer(),
  );
}

export async function readSpreadsheet(
  bytes: ArrayBuffer,
): Promise<SpreadsheetPreview> {
  checkSpreadsheetArchive(bytes);
  const book = new ExcelJS.Workbook();
  try {
    await book.xlsx.load(bytes, {
      ignoreNodes: [
        "dataValidations",
        "conditionalFormatting",
        "drawing",
        "picture",
        "extLst",
      ],
    });
  } catch {
    throw new Error(
      "The workbook could not be opened. Save an unencrypted .xlsx copy using the SchoolCal template.",
    );
  }
  return parseSpreadsheet(book);
}

export function parseSpreadsheet(book: ExcelJS.Workbook): SpreadsheetPreview {
  const issues: SpreadsheetIssue[] = [],
    warnings: string[] = [];
  const problem = (location: string, message: string) => {
    if (
      issues.length < 100 &&
      !issues.some(
        (issue) => issue.location === location && issue.message === message,
      )
    )
      issues.push({ location, message });
  };
  if (
    book.worksheets.length > 20 ||
    book.worksheets.some((ws) => ws.rowCount > 1201 || ws.columnCount > 20)
  )
    throw new SpreadsheetError([
      {
        location: "Workbook",
        message:
          "The workbook has too many rows, columns or sheets. Use the SchoolCal template.",
      },
    ]);
  const text = (cell: Cell, limit = 500): string => {
    const value = cell.value;
    if (cell.isMerged) {
      problem(
        `${cell.worksheet.name}!${cell.address}`,
        "Unmerge this cell before importing.",
      );
      return "";
    }
    let result = "";
    if (value == null) return "";
    if (typeof value === "string" || typeof value === "number")
      result = String(value);
    else if (typeof value === "boolean") result = yesNo(value);
    else if (typeof value === "object" && "richText" in value)
      result = value.richText.map((part) => part.text).join("");
    else {
      problem(
        `${cell.worksheet.name}!${cell.address}`,
        "Use a plain value here, not a formula, link or error.",
      );
      return "";
    }
    if (result.length > limit)
      problem(
        `${cell.worksheet.name}!${cell.address}`,
        `Keep this value to ${limit} characters or fewer.`,
      );
    return result;
  };
  const location = (cell: Cell) => `${cell.worksheet.name}!${cell.address}`;
  const sheet = (name: string, headers: string[]) => {
    const ws = book.worksheets.find((ws) => normal(ws.name) === normal(name));
    if (!ws) {
      problem(
        name,
        `Missing sheet “${name}”. Keep all sheets from the SchoolCal template.`,
      );
      return book.addWorksheet(`Missing ${name}`);
    }
    headers.forEach((header, i) => {
      if (normal(text(ws.getCell(1, i + 1))) !== normal(header))
        problem(
          location(ws.getCell(1, i + 1)),
          `The heading must be “${header}”.`,
        );
    });
    for (let col = headers.length + 1; col <= ws.columnCount; col++)
      for (let row = 1; row <= ws.rowCount; row++)
        if (
          ws.getCell(row, col).value != null &&
          text(ws.getCell(row, col)).trim()
        )
          problem(
            location(ws.getCell(row, col)),
            "This column is outside the template. Move its values into the correct columns.",
          );
    return ws;
  };
  const rows = (ws: Worksheet, max: number) => {
    const result: Cell[][] = [];
    for (let row = 2; row <= ws.rowCount; row++) {
      const cells = Array.from({ length: ws.columnCount }, (_, col) =>
        ws.getCell(row, col + 1),
      );
      for (const cell of cells)
        if (cell.isMerged)
          problem(location(cell), "Unmerge this cell before importing.");
      if (
        cells.some(
          (cell) => cell.value != null && String(cell.value).trim() !== "",
        )
      )
        result.push(cells);
    }
    if (result.length > max)
      problem(ws.name, `Use no more than ${max} rows on this sheet.`);
    return result.slice(0, max);
  };
  const required = (cell: Cell, label: string, limit = 500) => {
    const value = text(cell, limit);
    if (!value.trim()) problem(location(cell), `Enter ${label}.`);
    return value;
  };
  const boolean = (cell: Cell, fallback = false) => {
    const value = normal(text(cell));
    if (!value) return fallback;
    if (["yes", "true"].includes(value)) return true;
    if (["no", "false"].includes(value)) return false;
    problem(location(cell), "Choose Yes or No.");
    return fallback;
  };
  const number = (cell: Cell, max: number) => {
    const value = Number(text(cell));
    if (!Number.isInteger(value) || value < 1 || value > max) {
      problem(location(cell), `Enter a whole number from 1 to ${max}.`);
      return 1;
    }
    return value;
  };
  const date = (cell: Cell, optional = false) => {
    const value =
      cell.value instanceof Date && Number.isFinite(cell.value.getTime())
        ? cell.value.toISOString().slice(0, 10)
        : text(cell);
    if (!(optional && !value) && !validDate(value))
      problem(
        location(cell),
        "Use a date from 1900 to 2200, written YYYY-MM-DD, or an Excel date cell.",
      );
    return value;
  };
  const time = (cell: Cell) => {
    let value: string;
    if (typeof cell.value === "number" && cell.value >= 0 && cell.value < 1) {
      const minutes = cell.value * 1440;
      if (Math.abs(minutes - Math.round(minutes)) > 0.00001)
        problem(location(cell), "Use whole minutes, without seconds.");
      const rounded = Math.round(minutes);
      value = `${String(Math.floor(rounded / 60)).padStart(2, "0")}:${String(rounded % 60).padStart(2, "0")}`;
    } else if (
      cell.value instanceof Date &&
      Number.isFinite(cell.value.getTime())
    ) {
      if (cell.value.getUTCSeconds() || cell.value.getUTCMilliseconds())
        problem(location(cell), "Use whole minutes, without seconds.");
      value = cell.value.toISOString().slice(11, 16);
    } else value = text(cell);
    if (!validTime(value))
      problem(
        location(cell),
        "Use a 24-hour time such as 08:45, or an Excel time cell.",
      );
    return value;
  };
  const code = (cell: Cell, used: Set<string>) => {
    const value = text(cell, 100).trim();
    if (!/^[a-zA-Z0-9_-]+$/.test(value))
      problem(
        location(cell),
        "Use a code containing only letters, numbers, underscores or hyphens.",
      );
    if (used.has(normal(value)))
      problem(
        location(cell),
        `The code “${value}” is already used on this sheet.`,
      );
    used.add(normal(value));
    return value;
  };
  const reference = (cell: Cell, records: { id: string }[], label: string) => {
    const value = text(cell).trim(),
      record = records.find((record) => normal(record.id) === normal(value));
    if (!record)
      problem(
        location(cell),
        `Unknown ${label} code “${value}”. Check the ${label === "subject" ? "Subjects" : label === "period" ? "Periods" : "Categories"} sheet.`,
      );
    return record?.id ?? value;
  };
  const day = (cell: Cell) => {
    const value = normal(text(cell)),
      found = DAY_NAMES.findIndex(
        (name) => normal(name) === value || normal(name.slice(0, 3)) === value,
      );
    if (found < 0) problem(location(cell), "Enter a day such as Monday.");
    return found < 0 ? 1 : found;
  };
  const metadata = book.worksheets.find((ws) => normal(ws.name) === "read me");
  if (
    !metadata ||
    text(metadata.getCell("A1")) !== "SchoolCal spreadsheet" ||
    text(metadata.getCell("B1")) !== "1"
  )
    problem(
      "Read me!A1:B1",
      "This is not a supported SchoolCal spreadsheet (version 1). Start with the downloadable template.",
    );
  const settingsSheet = sheet("Settings", SHEET_HEADERS.Settings);
  const settingCells = new Map<string, Cell>();
  for (const row of rows(settingsSheet, SETTINGS.length)) {
    const key = normal(text(row[0]));
    if (settingCells.has(key))
      problem(location(row[0]), "This setting appears more than once.");
    if (!SETTINGS.some((name) => normal(name) === key))
      problem(
        location(row[0]),
        "This setting is not recognised. Keep the template setting names.",
      );
    settingCells.set(key, row[1] ?? settingsSheet.getCell(row[0].row, 2));
  }
  const setting = (name: string) => {
    const cell = settingCells.get(normal(name));
    if (!cell) problem("Settings", `Missing setting “${name}”.`);
    return cell ?? settingsSheet.getCell(SETTINGS.indexOf(name) + 2, 2);
  };
  const p = createProject();
  p.name = required(setting("Timetable name"), "a timetable name");
  const firstDay = setting("First school day"),
    lastDay = setting("Last school day");
  p.academicYear.startDate = date(firstDay, true);
  p.academicYear.endDate = date(lastDay, true);
  if (
    validDate(p.academicYear.startDate) &&
    validDate(p.academicYear.endDate) &&
    (p.academicYear.endDate <= p.academicYear.startDate ||
      daysBetween(p.academicYear.startDate, p.academicYear.endDate) > 1096)
  )
    problem(
      location(lastDay),
      "The last school day must follow the first, within three years.",
    );
  const daysCell = setting("School days"),
    days = text(daysCell).split(/[,;]/).map(normal).filter(Boolean);
  p.academicYear.schoolWeekdays = days.map((value) =>
    DAY_NAMES.findIndex(
      (day) => normal(day) === value || normal(day.slice(0, 3)) === value,
    ),
  );
  if (
    !days.length ||
    p.academicYear.schoolWeekdays.includes(-1) ||
    new Set(p.academicYear.schoolWeekdays).size !== days.length
  )
    problem(
      location(daysCell),
      "List different school days separated by commas, such as Monday, Tuesday, Wednesday, Thursday, Friday.",
    );
  p.academicYear.timezone = text(setting("Time zone")).trim();
  if (!validTimezone(p.academicYear.timezone))
    problem(
      location(setting("Time zone")),
      "Use a school time zone such as Europe/London or America/New_York.",
    );
  p.cycleLength = number(
    setting("Weeks in rotation"),
    4,
  ) as TimetableProject["cycleLength"];
  const labels = normal(text(setting("Week labels")));
  if (!["letters", "numbers"].includes(labels))
    problem(location(setting("Week labels")), "Choose Letters or Numbers.");
  p.rotationLabelStyle = labels === "letters" ? "letters" : "numbers";
  p.initialRotationIndex = number(setting("First week"), p.cycleLength) - 1;
  const status = normal(text(setting("Setup status")));
  if (!["complete", "in progress"].includes(status))
    problem(
      location(setting("Setup status")),
      "Choose Complete or In progress.",
    );
  p.setupComplete = status === "complete";
  const step = SETUP_PAGES.findIndex(
    (name) => normal(name) === normal(text(setting("Resume setup at"))),
  );
  if (step < 0)
    problem(
      location(setting("Resume setup at")),
      "Choose a setup page from the list.",
    );
  p.setupStep = Math.max(0, step);
  const categorySet = new Set<string>();
  p.periodCategories = rows(
    sheet("Categories", SHEET_HEADERS.Categories),
    40,
  ).map((row) => ({
    id: code(row[0], categorySet),
    name: required(row[1], "a category name", 80),
    allowSubjects: boolean(row[2]),
  }));
  const categoryNames = new Set<string>();
  p.periodCategories.forEach((category) => {
    if (categoryNames.has(normal(category.name)))
      problem(
        "Categories",
        `Use a different name for each category: “${category.name}” appears more than once.`,
      );
    categoryNames.add(normal(category.name));
  });
  const periodSet = new Set<string>();
  p.periods = rows(sheet("Periods", SHEET_HEADERS.Periods), 40).map(
    (row, sortOrder) => {
      const startTime = time(row[2]),
        endTime = time(row[3]);
      if (validTime(startTime) && validTime(endTime) && endTime <= startTime)
        problem(
          location(row[3]),
          "The end time must be after the start time, on the same day.",
        );
      return {
        id: code(row[0], periodSet),
        name: required(row[1], "a period name"),
        startTime,
        endTime,
        categoryId: reference(row[4], p.periodCategories, "category"),
        sortOrder,
      };
    },
  );
  const subjectSet = new Set<string>();
  p.subjects = rows(sheet("Subjects", SHEET_HEADERS.Subjects), 100).map(
    (row, i) => {
      const colour = text(row[5]).trim() || COLOURS[i % COLOURS.length];
      if (!/^#[a-fA-F0-9]{6}$/.test(colour))
        problem(
          location(row[5]),
          "Use a colour such as #6484ba, or leave it empty.",
        );
      return {
        id: code(row[0], subjectSet),
        name: required(row[1], "a subject name"),
        ...(text(row[2]) ? { shortName: text(row[2]) } : {}),
        ...(text(row[3]) ? { teacher: text(row[3]) } : {}),
        ...(text(row[4]) ? { room: text(row[4]) } : {}),
        colour,
      };
    },
  );
  p.academicYear.exclusions = rows(
    sheet("Holidays", SHEET_HEADERS.Holidays),
    200,
  ).map((row) => {
    const startDate = date(row[1]),
      endDate = date(row[2]);
    if (validDate(startDate) && validDate(endDate) && endDate < startDate)
      problem(
        location(row[2]),
        "The last day must be on or after the first day.",
      );
    return {
      id: newId(),
      name: required(row[0], "a holiday name"),
      startDate,
      endDate,
      resetRotationAfter: boolean(row[3]),
    };
  });
  for (let week = 0; week < 4; week++) {
    const ws = sheet(`Week ${week + 1}`, WEEK_HEADERS),
      seen = new Set<string>();
    for (const row of rows(ws, 40)) {
      const periodId = reference(row[0], p.periods, "period");
      if (seen.has(normal(periodId)))
        problem(
          location(row[0]),
          "This period already has a row in this week. Combine its lessons into one row.",
        );
      seen.add(normal(periodId));
      for (let i = 0; i < WEEKDAYS.length; i++) {
        const cell = row[i + 1];
        if (!text(cell).trim()) continue;
        p.entries.push({
          id: newId(),
          rotationIndex: week,
          weekday: WEEKDAYS[i],
          periodId,
          subjectId: reference(cell, p.subjects, "subject"),
        });
      }
    }
  }
  const detailsSeen = new Set<string>();
  for (const row of rows(
    sheet("Lesson details", SHEET_HEADERS["Lesson details"]),
    1120,
  )) {
    const week = number(row[0], 4) - 1,
      weekday = day(row[1]),
      periodId = reference(row[2], p.periods, "period");
    const key = `${week}:${weekday}:${periodId}`;
    if (detailsSeen.has(key))
      problem(
        location(row[0]),
        "Details for this lesson are repeated. Keep one row for each lesson.",
      );
    detailsSeen.add(key);
    const entry = p.entries.find(
      (e) =>
        e.rotationIndex === week &&
        e.weekday === weekday &&
        e.periodId === periodId,
    );
    if (!entry) {
      problem(
        location(row[0]),
        "There is no subject in this week/day/period grid cell. Add it to the week grid or remove these details.",
      );
      continue;
    }
    for (const [flag, value, property] of [
      [3, 4, "titleOverride"],
      [5, 6, "teacherOverride"],
      [7, 8, "roomOverride"],
    ] as const) {
      const enabled = boolean(row[flag]),
        content = text(row[value]);
      if (!enabled && content)
        problem(
          location(row[flag]),
          "Choose Yes to use the override, or clear its value.",
        );
      if (enabled) {
        entry[property] = content;
        if (property === "titleOverride" && !content.trim())
          problem(
            location(row[value]),
            "Enter a title, or set Override title to No.",
          );
      }
    }
    const notes = text(row[9], 4000);
    if (notes) entry.notes = notes;
  }
  if (issues.length) throw new SpreadsheetError(issues);
  // Reuse the backup's structural/reference validation after cell-level feedback.
  const project = parseProject(serializeProject(p));
  const validation = validateProject(project);
  warnings.push(...validation.warnings);
  if (validation.errors.length) {
    warnings.push(
      "This timetable will be saved as a draft.",
      ...validation.errors,
    );
    if (project.setupComplete) {
      project.setupComplete = false;
      project.setupStep =
        !validDate(project.academicYear.startDate) ||
        !validDate(project.academicYear.endDate)
          ? 0
          : !project.periods.length
            ? 3
            : !project.subjects.length
              ? 4
              : 5;
    }
  }
  const hidden = project.entries.filter(
    (e) =>
      e.rotationIndex >= project.cycleLength ||
      !project.academicYear.schoolWeekdays.includes(e.weekday) ||
      !project.periodCategories.find(
        (c) =>
          c.id ===
          project.periods.find((period) => period.id === e.periodId)
            ?.categoryId,
      )?.allowSubjects,
  ).length;
  if (hidden)
    warnings.push(
      `${hidden} lesson slots are kept in hidden weeks, days or fixed periods. They return when you enable those settings.`,
    );
  const known = new Set([
    "read me",
    ...Object.keys(SHEET_HEADERS).map(normal),
    ...Array.from({ length: 4 }, (_, i) => `week ${i + 1}`),
  ]);
  for (const ws of book.worksheets)
    if (!known.has(normal(ws.name)))
      warnings.push(
        `The extra sheet “${ws.name}” is not part of the timetable and will not be imported.`,
      );
  return { project, warnings: [...new Set(warnings)] };
}
