import { describe, expect, it } from "vitest";
import { generateOccurrences } from "./occurrences";
import { holiday, testProject } from "./test-helpers";
import { weekday } from "./dates";

describe("individual lesson occurrences", () => {
  it("only generates enabled weekdays within inclusive academic boundaries", () => {
    const p = testProject();
    p.academicYear.startDate = "2026-09-09";
    p.academicYear.endDate = "2026-09-21";
    const events = generateOccurrences(p);
    expect(events).toHaveLength(9);
    expect(events[0].date).toBe("2026-09-09");
    expect(events.at(-1)?.date).toBe("2026-09-21");
    expect(events.every((e) => [1, 2, 3, 4, 5].includes(weekday(e.date)))).toBe(
      true,
    );
  });
  it("generates nothing during holidays and inset days", () => {
    const p = testProject();
    p.academicYear.exclusions = [
      holiday("2026-09-14", "2026-09-18"),
      holiday("2026-09-22", "2026-09-22"),
    ];
    const dates = generateOccurrences(p).map((e) => e.date);
    expect(dates).not.toContain("2026-09-14");
    expect(dates).not.toContain("2026-09-18");
    expect(dates).not.toContain("2026-09-22");
  });
  it("registration, breaks and lunch are opt-in and ignore old subject assignments", () => {
    const p = testProject();
    p.academicYear.endDate = "2026-09-11";
    p.periods.unshift({
      id: "registration",
      name: "Tutor period",
      type: "registration",
      startTime: "08:30",
      endTime: "08:45",
      sortOrder: 0,
    });
    p.periods.forEach((period, index) => {
      period.sortOrder = index;
    });
    p.entries.push({
      id: "old-registration-entry",
      rotationIndex: 0,
      weekday: 1,
      periodId: "registration",
      subjectId: "maths",
      titleOverride: "Old subject title",
      teacherOverride: "Old teacher",
      roomOverride: "Old room",
      notes: "Old lesson notes",
    });
    p.entries.push({
      id: "bad-break-entry",
      rotationIndex: 0,
      weekday: 1,
      periodId: "break",
      subjectId: "maths",
    });
    expect(generateOccurrences(p)).toHaveLength(5);
    const before = structuredClone(p);
    const events = generateOccurrences(p, true);
    expect(events).toHaveLength(20);
    const registration = events.filter((e) => e.title === "Tutor period");
    expect(registration).toHaveLength(5);
    expect(
      registration.every(
        (e) => e.structural && !e.teacher && !e.room && !e.notes,
      ),
    ).toBe(true);
    expect(events.filter((e) => e.title === "Break")).toHaveLength(5);
    expect(events.filter((e) => e.title === "Lunch")).toHaveLength(5);
    expect(p).toEqual(before);
  });
  it.each([false, true])(
    "uses the correct timetable after a holiday (reset: %s)",
    (reset) => {
      const p = testProject();
      p.academicYear.exclusions = [holiday("2026-09-14", "2026-09-25", reset)];
      expect(
        generateOccurrences(p).find((e) => e.date === "2026-09-28")?.title,
      ).toBe(reset ? "Mathematics" : "English");
    },
  );
  it.each([1, 2, 3, 4] as const)(
    "generates a %i-week rotation correctly",
    (cycle) => {
      const p = testProject();
      p.cycleLength = cycle;
      expect(
        generateOccurrences(p)
          .filter((e) => weekday(e.date) === 1)
          .slice(0, 8)
          .map((e) => e.rotationIndex),
      ).toEqual(Array.from({ length: 8 }, (_, i) => i % cycle));
    },
  );
  it("empty cells generate nothing and only lesson or other blocks can contain subjects", () => {
    const p = testProject();
    p.entries = p.entries.filter(
      (e) => e.weekday === 1 && e.rotationIndex === 0,
    );
    expect(
      generateOccurrences(p).every(
        (e) => weekday(e.date) === 1 && e.rotationIndex === 0,
      ),
    ).toBe(true);
    p.periods[0].type = "registration";
    expect(generateOccurrences(p)).toEqual([]);
    p.periods[0].type = "other";
    expect(generateOccurrences(p).length).toBeGreaterThan(0);
    p.entries = [];
    expect(generateOccurrences(p)).toEqual([]);
  });
  it("uses current subject defaults and stores only explicit overrides", () => {
    const p = testProject(),
      entry = p.entries.find((e) => e.rotationIndex === 0 && e.weekday === 1)!;
    expect(generateOccurrences(p)[0]).toMatchObject({
      teacher: "Mrs Jones",
      room: "M12",
      title: "Mathematics",
    });
    entry.teacherOverride = "Mr Smith";
    entry.roomOverride = "Lab 3";
    entry.titleOverride = "Mechanics";
    entry.notes = "Bring calculator";
    expect(generateOccurrences(p)[0]).toMatchObject({
      teacher: "Mr Smith",
      room: "Lab 3",
      title: "Mechanics",
      notes: "Bring calculator",
    });
    entry.teacherOverride = "";
    entry.roomOverride = "";
    expect(generateOccurrences(p)[0]).toMatchObject({ teacher: "", room: "" });
    delete entry.roomOverride;
    p.subjects[0].room = "M99";
    expect(generateOccurrences(p)[0].room).toBe("M99");
  });
  it("returns occurrences in date/time order even when periods were reordered", () => {
    const p = testProject();
    p.periods[0].sortOrder = 3;
    expect(
      generateOccurrences(p, true)
        .slice(0, 3)
        .map((e) => e.startTime),
    ).toEqual(["09:00", "10:00", "12:00"]);
  });
  it("disabled weekdays and hidden rotation weeks remain stored without exporting", () => {
    const p = testProject();
    p.cycleLength = 1;
    p.academicYear.schoolWeekdays = [6];
    const entries = p.entries.length;
    expect(
      generateOccurrences(p).every(
        (e) => e.rotationIndex === 0 && weekday(e.date) === 6,
      ),
    ).toBe(true);
    expect(p.entries).toHaveLength(entries);
  });
});
