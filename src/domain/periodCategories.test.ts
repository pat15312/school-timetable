import { describe, expect, it } from "vitest";
import { sampleProject, withStandardDay } from "./fixture";
import { createProject, defaultPeriodCategories, isStructural } from "./model";
import { deletePeriodCategory, savePeriodCategory } from "./periodCategories";
import {
  parseProject,
  readProject,
  serializeProject,
  STORAGE_KEY,
} from "./persistence";
import { generateOccurrences } from "./occurrences";
import { preparePrintPages } from "./print";
import { validateProject } from "./validation";
import { buildCalendar } from "./calendar";

describe("editable period categories", () => {
  it("starts with four categories and lets the flag determine behaviour regardless of their IDs or names", () => {
    const p = sampleProject();
    expect(p.periodCategories).toEqual(defaultPeriodCategories());
    expect(p.periodCategories.map((c) => c.name)).not.toContain("Other");
    const registration = p.periods[0];
    expect(isStructural(registration, p)).toBe(true);
    const teaching = savePeriodCategory(p, {
      id: "registration",
      name: "Tutorial",
      allowSubjects: true,
    });
    expect(isStructural(registration, teaching)).toBe(false);
    const fixedLesson = savePeriodCategory(p, {
      id: "lesson",
      name: "Unsupervised study",
      allowSubjects: false,
    });
    expect(isStructural(p.periods[1], fixedLesson)).toBe(true);
    expect(validateProject(fixedLesson).errors).toContain(
      "Place at least one subject in your timetable.",
    );
  });

  it("custom flags control printing and optional export, and switching back restores saved lesson details and UIDs", () => {
    let p = sampleProject();
    p.academicYear.endDate = "2026-09-11";
    const original = generateOccurrences(p).find(
      (e) => e.date === "2026-09-07" && e.startTime === "08:45",
    )!;
    p = savePeriodCategory(p, {
      id: "custom-study",
      name: "Study session",
      allowSubjects: true,
    });
    p.periods[1] = {
      ...p.periods[1],
      name: "Study session",
      categoryId: "custom-study",
    };
    const entries = structuredClone(p.entries);
    expect(generateOccurrences(p).find((e) => e.uid === original.uid)).toEqual(
      original,
    );
    p = savePeriodCategory(p, {
      ...p.periodCategories.at(-1)!,
      allowSubjects: false,
    });
    expect(generateOccurrences(p).some((e) => e.startTime === "08:45")).toBe(
      false,
    );
    const fixed = generateOccurrences(p, true).filter(
      (e) => e.startTime === "08:45",
    );
    expect(fixed).toHaveLength(5);
    expect(
      fixed.every(
        (e) =>
          e.title === "Study session" && e.structural && !e.teacher && !e.room,
      ),
    ).toBe(true);
    expect(preparePrintPages(p, "landscape")[0][0].rows[1].cells).toEqual([
      null,
      null,
      null,
      null,
      null,
    ]);
    expect(buildCalendar(p)).not.toContain("SUMMARY:Study session");
    expect(buildCalendar(p, true)).toContain("SUMMARY:Study session");
    p = savePeriodCategory(p, {
      ...p.periodCategories.at(-1)!,
      allowSubjects: true,
    });
    expect(p.entries).toEqual(entries);
    expect(generateOccurrences(p).find((e) => e.uid === original.uid)).toEqual(
      original,
    );
    expect(
      preparePrintPages(p, "landscape")[0][0].rows[1].cells[0],
    ).toMatchObject({
      title: original.title,
      teacher: original.teacher,
      room: original.room,
    });
  });

  it("renames default period labels without changing custom names, IDs, or calendar identity", () => {
    const p = sampleProject();
    p.periods.push({
      ...p.periods[3],
      id: "afternoon",
      name: "Afternoon break",
      startTime: "15:00",
      endTime: "15:15",
      sortOrder: 8,
    });
    const original = generateOccurrences(p, true);
    const renamed = savePeriodCategory(p, {
      id: "break",
      name: "Rest",
      allowSubjects: false,
    });
    expect(renamed.periods[3].name).toBe("Rest");
    expect(renamed.periods.at(-1)?.name).toBe("Afternoon break");
    expect(renamed.periods.map((period) => period.id)).toEqual(
      p.periods.map((period) => period.id),
    );
    expect(generateOccurrences(renamed, true).map((e) => e.uid)).toEqual(
      original.map((e) => e.uid),
    );
    expect(p.periodCategories.find((c) => c.id === "break")?.name).toBe(
      "Break",
    );
  });

  it("requires a valid replacement for used categories and preserves periods and entries when deleting", () => {
    const p = sampleProject();
    const original = structuredClone(p);
    for (const replacement of [undefined, "lesson", "missing"])
      expect(() => deletePeriodCategory(p, "lesson", replacement)).toThrow(
        "replacement",
      );
    expect(p).toEqual(original);
    const next = deletePeriodCategory(p, "lesson", "registration");
    expect(next.entries).toEqual(p.entries);
    expect(next.periods.map(({ categoryId: _, ...period }) => period)).toEqual(
      p.periods.map(({ categoryId: _, ...period }) => period),
    );
    expect(next.periods.some((period) => period.categoryId === "lesson")).toBe(
      false,
    );
    expect(
      next.periodCategories.some((category) => category.id === "lesson"),
    ).toBe(false);
    expect(parseProject(serializeProject(next))).toEqual(next);
    const empty = createProject();
    for (const category of empty.periodCategories)
      empty.periodCategories = deletePeriodCategory(
        empty,
        category.id,
      ).periodCategories;
    expect(parseProject(serializeProject(empty)).periodCategories).toEqual([]);
  });

  it("rejects blank or duplicate names and category overflow, while allowing edits at the limit", () => {
    const p = createProject();
    for (const name of ["  ", " lEsSoN "])
      expect(() =>
        savePeriodCategory(p, { id: "new", name, allowSubjects: false }),
      ).toThrow();
    p.periodCategories = Array.from({ length: 40 }, (_, i) => ({
      id: `category-${i}`,
      name: `Category ${i}`,
      allowSubjects: true,
    }));
    expect(() =>
      savePeriodCategory(p, {
        id: "extra",
        name: "Extra",
        allowSubjects: false,
      }),
    ).toThrow("40");
    expect(
      savePeriodCategory(p, { ...p.periodCategories[0], name: "Renamed" })
        .periodCategories[0].name,
    ).toBe("Renamed");
  });

  it("standard-day creation respects edited categories and rebuilds deleted defaults with valid references", () => {
    let p = createProject();
    p = savePeriodCategory(p, {
      id: "registration",
      name: "Tutor time",
      allowSubjects: true,
    });
    p = deletePeriodCategory(p, "break");
    p = savePeriodCategory(p, {
      id: "custom-break",
      name: "Break",
      allowSubjects: false,
    });
    const next = withStandardDay(p);
    expect(next.periods[0]).toMatchObject({
      name: "Tutor time",
      categoryId: "registration",
    });
    expect(isStructural(next.periods[0], next)).toBe(false);
    expect(next.periods[3].categoryId).toBe("custom-break");
    expect(parseProject(serializeProject(next))).toEqual(next);
    p.periodCategories = [];
    expect(withStandardDay(p).periodCategories).toEqual(
      defaultPeriodCategories(),
    );
  });
});

describe("category backup upgrades", () => {
  const legacy = () => {
    const { periodCategories: _, ...p } = sampleProject();
    return {
      schemaVersion: 1,
      timetable: {
        ...p,
        periods: p.periods.map(({ categoryId, ...period }) => ({
          ...period,
          type: categoryId,
        })),
      },
    };
  };
  it("upgrades version 1 saved projects and Other periods without losing names, subjects, IDs or overrides", () => {
    const backup = legacy();
    backup.timetable.periods[1].type = "other";
    backup.timetable.periods[1].name = "Supervised study";
    backup.timetable.entries[0].notes = "Keep these notes";
    backup.timetable.entries[0].roomOverride = "R12";
    const json = JSON.stringify(backup);
    const upgraded = parseProject(json);
    expect(upgraded.periodCategories).toEqual(defaultPeriodCategories());
    expect(upgraded.periods[1]).toMatchObject({
      id: backup.timetable.periods[1].id,
      name: "Supervised study",
      categoryId: "lesson",
    });
    expect(upgraded.entries).toEqual(backup.timetable.entries);
    expect(upgraded.subjects).toEqual(backup.timetable.subjects);
    expect(
      readProject({ getItem: (key) => (key === STORAGE_KEY ? json : null) })
        .project,
    ).toEqual(upgraded);
    const saved = serializeProject(upgraded);
    expect(JSON.parse(saved).schemaVersion).toBe(2);
    expect(parseProject(saved)).toEqual(upgraded);
  });
  it("rejects broken category references, duplicate identities or names, missing flags and unknown legacy types", () => {
    const p = sampleProject();
    p.periods[0].categoryId = "missing";
    expect(() => parseProject(serializeProject(p))).toThrow(
      "missing period category",
    );
    p.periods[0].categoryId = "registration";
    p.periodCategories.push(p.periodCategories[0]);
    expect(() => parseProject(serializeProject(p))).toThrow("duplicate IDs");
    p.periodCategories.pop();
    p.periodCategories[1].name = "LESSON";
    expect(() => parseProject(serializeProject(p))).toThrow(
      "duplicate period category names",
    );
    const invalid = JSON.parse(serializeProject(sampleProject()));
    delete invalid.timetable.periodCategories[0].allowSubjects;
    expect(() => parseProject(JSON.stringify(invalid))).toThrow(
      "not a supported",
    );
    const old = legacy();
    old.timetable.periods[0].type = "unknown";
    expect(() => parseProject(JSON.stringify(old))).toThrow("not a supported");
  });
});
