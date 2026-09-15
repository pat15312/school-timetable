import { describe, expect, it } from "vitest";
import { addDays, formatDate, mondayOf, validDate, weekday } from "./dates";
import { preparePrintPages } from "./print";
import {
  parseProject,
  readProject,
  saveProject,
  serializeProject,
} from "./persistence";
import { validateProject } from "./validation";
import { duplicateWeek, putEntry } from "./editing";
import { testProject } from "./test-helpers";

describe("local calendar date arithmetic", () => {
  it.each([
    ["2026-03-28", "2026-03-29"],
    ["2026-10-24", "2026-10-25"],
    ["2026-12-31", "2027-01-01"],
    ["2028-02-28", "2028-02-29"],
    ["2028-02-29", "2028-03-01"],
    ["2027-02-28", "2027-03-01"],
  ])("adds one day to %s without timezone shifts", (from, to) =>
    expect(addDays(from, 1)).toBe(to),
  );
  it("validates leap days and impossible dates", () => {
    expect(validDate("2028-02-29")).toBe(true);
    for (const date of [
      "",
      "2027-02-29",
      "2026-13-01",
      "2026-00-01",
      "2026-02-30",
      "2026-9-7",
    ])
      expect(validDate(date)).toBe(false);
  });
  it("uses Monday–Sunday weeks and formats civil dates without interpreting them as instants", () => {
    expect(mondayOf("2026-09-13")).toBe("2026-09-07");
    expect(weekday("2026-09-07")).toBe(1);
    expect(formatDate("2026-09-07", { day: "numeric" })).toBe("7");
  });
});
describe("print preparation", () => {
  it.each([1, 2, 3, 4] as const)(
    "prepares %i landscape pages with one week each",
    (length) => {
      const p = testProject();
      p.cycleLength = length;
      const pages = preparePrintPages(p, "landscape");
      expect(pages).toHaveLength(length);
      expect(pages.every((page) => page.length === 1)).toBe(true);
    },
  );
  it.each([
    [1, [[0]]],
    [2, [[0, 1]]],
    [3, [[0, 1], [2]]],
    [
      4,
      [
        [0, 1],
        [2, 3],
      ],
    ],
  ] as const)(
    "pairs a %i-week portrait timetable correctly",
    (length, expected) => {
      const p = testProject();
      p.cycleLength = length;
      expect(
        preparePrintPages(p, "portrait").map((page) =>
          page.map((week) => week.index),
        ),
      ).toEqual(expected);
    },
  );
  it("includes structural rows, labels, times and inherited/overridden lesson details", () => {
    const p = testProject();
    p.rotationLabelStyle = "letters";
    const pages = preparePrintPages(p, "portrait");
    expect(pages[0].map((w) => w.label)).toEqual(["Week A", "Week B"]);
    expect(
      pages[0][0].rows.filter((r) => r.structural).map((r) => r.period.name),
    ).toEqual(["Break", "Lunch"]);
    expect(pages[0][0].rows[0].cells[0]).toMatchObject({
      title: "Mathematics",
      room: "M12",
      teacher: "Mrs Jones",
    });
  });
});
describe("backup and autosave", () => {
  it("round-trips a versioned project without altering IDs", () => {
    const p = testProject();
    expect(parseProject(serializeProject(p))).toEqual(p);
  });
  it("preserves incomplete drafts for later editing", () => {
    const p = testProject();
    p.academicYear.startDate = "";
    p.periods[0].startTime = "";
    expect(parseProject(serializeProject(p))).toEqual(p);
  });
  it("rejects invalid schemas, unknown versions, oversized files, and invalid references", () => {
    for (const text of [
      "{}",
      "not json",
      '{"schemaVersion":99}',
      "x".repeat(2_000_001),
    ])
      expect(() => parseProject(text)).toThrow();
    const p = testProject();
    p.entries[0].subjectId = "missing";
    expect(() => parseProject(serializeProject(p))).toThrow("missing");
  });
  it("rejects duplicate cells, duplicate IDs, and invalid colours", () => {
    const p = testProject();
    p.entries.push({ ...p.entries[0], id: "duplicate-cell" });
    expect(() => parseProject(serializeProject(p))).toThrow("duplicate");
    p.entries.pop();
    p.subjects.push(p.subjects[0]);
    expect(() => parseProject(serializeProject(p))).toThrow("duplicate");
    p.subjects.pop();
    p.subjects[0].colour = "url(https://example.com)";
    expect(() => parseProject(serializeProject(p))).toThrow();
  });
  it("reports corrupt saved state without overwriting it and handles unavailable/full storage", () => {
    expect(readProject({ getItem: () => "broken" })).toMatchObject({
      project: null,
      raw: "broken",
      error: expect.any(String),
    });
    expect(readProject({ getItem: () => null }).project).toBeNull();
    expect(
      saveProject(
        {
          setItem: () => {
            throw new Error("Quota");
          },
        },
        testProject(),
      ),
    ).toBe(false);
  });
});
describe("validation and editing", () => {
  it("missing optional teacher and room never block export; overlapping holidays warn only", () => {
    const p = testProject();
    p.subjects.forEach((s) => {
      delete s.teacher;
      delete s.room;
    });
    p.academicYear.exclusions = [
      {
        id: "one",
        name: "Break",
        startDate: "2026-09-14",
        endDate: "2026-09-18",
        resetRotationAfter: false,
      },
      {
        id: "two",
        name: "Inset",
        startDate: "2026-09-15",
        endDate: "2026-09-15",
        resetRotationAfter: true,
      },
    ];
    expect(validateProject(p).errors).toEqual([]);
    expect(validateProject(p).warnings).toHaveLength(1);
  });
  it("rejects invalid dates, periods, school days and rotation", () => {
    const p = testProject();
    p.academicYear.endDate = p.academicYear.startDate;
    p.academicYear.schoolWeekdays = [];
    p.initialRotationIndex = 3;
    p.periods[0].endTime = "08:00";
    expect(validateProject(p).errors.length).toBeGreaterThanOrEqual(4);
  });
  it("placing, erasing and pasting preserve immutable history snapshots", () => {
    const p = testProject(),
      before = structuredClone(p.entries),
      cell = { rotationIndex: 0, weekday: 1, periodId: "p1" };
    const placed = putEntry(p.entries, cell, { ...cell, subjectId: "english" });
    expect(p.entries).toEqual(before);
    expect(
      placed.find((e) => e.rotationIndex === 0 && e.weekday === 1)?.subjectId,
    ).toBe("english");
    expect(putEntry(placed, cell, null)).toHaveLength(before.length - 1);
  });
  it("duplicating a week replaces only destination entries and preserves per-cell overrides", () => {
    const p = testProject();
    p.entries[0].roomOverride = "Lab 3";
    const before = structuredClone(p.entries);
    const entries = duplicateWeek(p.entries, 0, 1);
    expect(p.entries).toEqual(before);
    expect(entries.filter((e) => e.rotationIndex === 1)).toHaveLength(7);
    expect(
      entries.find((e) => e.rotationIndex === 1 && e.weekday === 0)
        ?.roomOverride,
    ).toBe("Lab 3");
    expect(new Set(entries.map((e) => e.id)).size).toBe(entries.length);
    expect(entries.filter((e) => e.rotationIndex === 2)).toEqual(
      before.filter((e) => e.rotationIndex === 2),
    );
  });
});
