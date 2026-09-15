import { describe, expect, it } from "vitest";
import {
  getRotationLabel,
  getTeachingWeeks,
  isExcluded,
  isTeachingDay,
} from "./rotation";
import { holiday, testProject } from "./test-helpers";
import { sampleProject } from "./fixture";

describe("teaching week rotation", () => {
  it("uses one central label mapping without changing rotation indexes", () => {
    expect([0, 1, 2, 3].map((i) => getRotationLabel(i, "letters"))).toEqual([
      "Week A",
      "Week B",
      "Week C",
      "Week D",
    ]);
    expect([0, 1, 2, 3].map((i) => getRotationLabel(i, "numbers"))).toEqual([
      "Week 1",
      "Week 2",
      "Week 3",
      "Week 4",
    ]);
    const p = testProject(),
      numbered = getTeachingWeeks(p);
    p.rotationLabelStyle = "letters";
    expect(getTeachingWeeks(p)).toEqual(numbered);
  });
  it.each([1, 2, 3, 4] as const)(
    "advances a %i-week cycle once per teaching week",
    (length) => {
      const p = testProject();
      p.cycleLength = length;
      expect(
        getTeachingWeeks(p)
          .slice(0, 8)
          .map((w) => w.rotationIndex),
      ).toEqual(Array.from({ length: 8 }, (_, i) => i % length));
    },
  );
  it.each([
    ["2026-09-14", "2026-09-18", "2026-09-21"],
    ["2026-09-14", "2026-09-25", "2026-09-28"],
  ])(
    "a holiday from %s to %s consumes no rotation weeks",
    (start, end, back) => {
      const p = testProject();
      p.academicYear.exclusions = [holiday(start, end)];
      const weeks = getTeachingWeeks(p);
      expect(weeks.slice(0, 3).map((w) => w.rotationIndex)).toEqual([0, 1, 0]);
      expect(weeks[1].startDate).toBe(back);
    },
  );
  it("resets after Christmas for both naming styles", () => {
    for (const style of ["letters", "numbers"] as const) {
      const p = testProject();
      p.rotationLabelStyle = style;
      p.initialRotationIndex = 1;
      p.academicYear.exclusions = [holiday("2026-09-14", "2026-09-25", true)];
      expect(
        getTeachingWeeks(p)
          .slice(0, 3)
          .map((w) => w.rotationIndex),
      ).toEqual([1, 0, 1]);
    }
  });
  it("handles multiple holidays in any input order over the entire year", () => {
    const p = sampleProject();
    p.academicYear.exclusions.reverse();
    const byDate = new Map(
      getTeachingWeeks(p).map((w) => [w.startDate, w.rotationIndex]),
    );
    expect(byDate.get("2026-10-19")).toBe(0);
    expect(byDate.has("2026-10-26")).toBe(false);
    expect(byDate.get("2026-11-02")).toBe(1);
    expect(byDate.get("2026-12-14")).toBe(1);
    expect(byDate.get("2027-01-04")).toBe(0);
    expect(byDate.get("2027-02-08")).toBe(1);
    expect(byDate.get("2027-02-22")).toBe(0);
    expect(byDate.get("2027-04-12")).toBe(0);
  });
  it("a single inset day does not alter the weekly sequence", () => {
    const p = testProject(),
      expected = getTeachingWeeks(p).map((w) => w.rotationIndex);
    p.academicYear.exclusions = [holiday("2026-09-15", "2026-09-15")];
    expect(getTeachingWeeks(p).map((w) => w.rotationIndex)).toEqual(expected);
    expect(getTeachingWeeks(p)[1].dates).not.toContain("2026-09-15");
  });
  it("starts a partial school week in the selected rotation", () => {
    const p = testProject();
    p.academicYear.startDate = "2026-09-09";
    p.initialRotationIndex = 1;
    expect(getTeachingWeeks(p).slice(0, 2)).toMatchObject([
      {
        startDate: "2026-09-07",
        dates: ["2026-09-09", "2026-09-10", "2026-09-11"],
        rotationIndex: 1,
      },
      { startDate: "2026-09-14", rotationIndex: 0 },
    ]);
  });
  it("resets the partial week in which teaching resumes after a long holiday", () => {
    const p = testProject();
    p.initialRotationIndex = 1;
    p.academicYear.exclusions = [holiday("2026-09-14", "2026-09-22", true)];
    expect(getTeachingWeeks(p)[1]).toMatchObject({
      startDate: "2026-09-21",
      rotationIndex: 0,
      dates: ["2026-09-23", "2026-09-24", "2026-09-25"],
    });
  });
  it("does not retroactively relabel a week already underway for a midweek reset", () => {
    const p = testProject();
    p.initialRotationIndex = 1;
    p.cycleLength = 3;
    p.academicYear.exclusions = [holiday("2026-09-08", "2026-09-09", true)];
    expect(
      getTeachingWeeks(p)
        .slice(0, 3)
        .map((w) => w.rotationIndex),
    ).toEqual([1, 0, 1]);
  });
  it("merges overlapping holidays, delaying a reset until actual teaching resumes", () => {
    const p = testProject();
    p.initialRotationIndex = 1;
    p.academicYear.exclusions = [
      holiday("2026-09-14", "2026-09-21", true),
      holiday("2026-09-18", "2026-10-02"),
    ];
    expect(getTeachingWeeks(p)[1]).toMatchObject({
      startDate: "2026-10-05",
      rotationIndex: 0,
    });
  });
  it("a single enabled day excluded for the entire week consumes no week", () => {
    const p = testProject();
    p.academicYear.schoolWeekdays = [3];
    p.academicYear.exclusions = [holiday("2026-09-16", "2026-09-16")];
    expect(getTeachingWeeks(p)[1]).toMatchObject({
      startDate: "2026-09-21",
      rotationIndex: 1,
    });
  });
  it("supports weekends, inclusive boundaries, and years containing no teaching days", () => {
    const p = testProject();
    p.academicYear.schoolWeekdays = [0, 6];
    expect(isTeachingDay("2026-09-12", p)).toBe(true);
    expect(isTeachingDay("2026-09-11", p)).toBe(false);
    p.academicYear.exclusions = [
      holiday(p.academicYear.startDate, p.academicYear.endDate, true),
    ];
    expect(getTeachingWeeks(p)).toEqual([]);
    expect(isExcluded(p.academicYear.endDate, p.academicYear.exclusions)).toBe(
      true,
    );
  });
  it("ignores a holiday outside the year and safely handles invalid or unbounded dates", () => {
    const p = testProject();
    p.initialRotationIndex = 1;
    p.academicYear.exclusions = [holiday("2025-01-01", "2025-03-01", true)];
    expect(getTeachingWeeks(p)[0].rotationIndex).toBe(1);
    p.academicYear.endDate = "2099-12-31";
    expect(getTeachingWeeks(p)).toEqual([]);
    p.academicYear.startDate = "";
    expect(getTeachingWeeks(p)).toEqual([]);
  });
});
