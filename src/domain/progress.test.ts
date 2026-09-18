import { describe, expect, it } from "vitest";
import { generateOccurrences } from "./occurrences";
import { getYearProgress } from "./progress";
import { getTeachingWeeks } from "./rotation";
import { holiday, testProject } from "./test-helpers";
import type { TimetableProject } from "./model";

function shortYear() {
  const p = testProject();
  p.academicYear.endDate = "2026-09-18";
  return p;
}
function progress(p: TimetableProject, now: string, includeFixed = false) {
  return getYearProgress(
    p,
    generateOccurrences(p, includeFixed),
    getTeachingWeeks(p),
    new Date(now),
  )!;
}

describe("school year progress", () => {
  it("counts lessons at their end, and weeks after the final school day's last period", () => {
    const p = shortYear();
    expect(progress(p, "2026-09-01T12:00:00Z").lessons).toEqual({
      total: 10,
      completed: 0,
      percentage: 0,
    });
    expect(progress(p, "2026-09-07T08:59:59Z").lessons.completed).toBe(0);
    expect(progress(p, "2026-09-07T09:00:00Z").lessons).toEqual({
      total: 10,
      completed: 1,
      percentage: 10,
    });
    expect(progress(p, "2026-09-11T11:59:59Z").weeks.completed).toBe(0);
    expect(progress(p, "2026-09-11T12:00:00Z").weeks).toEqual({
      total: 2,
      completed: 1,
      percentage: 50,
    });
    expect(progress(p, "2026-09-19T00:00:00Z")).toEqual({
      lessons: { total: 10, completed: 10, percentage: 100 },
      weeks: { total: 2, completed: 2, percentage: 100 },
    });
  });

  it("excludes holidays and completes partial weeks on their final school day", () => {
    const p = shortYear();
    p.academicYear.startDate = "2026-09-09";
    p.academicYear.endDate = "2026-09-25";
    p.academicYear.exclusions = [
      holiday("2026-09-14", "2026-09-18"),
      holiday("2026-09-25", "2026-09-25"),
    ];
    expect(progress(p, "2026-09-18T16:00:00Z")).toEqual({
      lessons: { total: 7, completed: 3, percentage: 42.8 },
      weeks: { total: 2, completed: 1, percentage: 50 },
    });
    expect(progress(p, "2026-09-24T12:00:00Z").weeks.percentage).toBe(100);
  });

  it("uses the school's daylight-saving offset on each date", () => {
    const p = shortYear();
    p.academicYear.startDate = "2026-10-23";
    p.academicYear.endDate = "2026-10-27";
    expect(progress(p, "2026-10-23T09:00:00Z").lessons.completed).toBe(1);
    expect(progress(p, "2026-10-26T09:59:59Z").lessons.completed).toBe(1);
    expect(progress(p, "2026-10-26T10:00:00Z").lessons.completed).toBe(2);
  });

  it("uses the school date when the device or UTC date is already tomorrow", () => {
    const p = shortYear();
    p.academicYear.timezone = "America/New_York";
    p.academicYear.endDate = "2026-09-08";
    p.periods = [{ ...p.periods[0], startTime: "23:00", endTime: "23:30" }];
    expect(progress(p, "2026-09-08T03:29:59Z").lessons.completed).toBe(0);
    expect(progress(p, "2026-09-08T03:30:00Z").lessons.completed).toBe(1);
  });

  it("counts weekends when configured and ignores fixed periods and empty cells in lesson totals", () => {
    const p = shortYear();
    p.academicYear.schoolWeekdays = [0, 6];
    p.entries = p.entries.filter((entry) => entry.weekday === 6);
    expect(progress(p, "2026-09-12T12:00:00Z", true).lessons).toEqual({
      total: 1,
      completed: 1,
      percentage: 100,
    });
    expect(progress(p, "2026-09-12T12:00:00Z").weeks.completed).toBe(0);
    expect(progress(p, "2026-09-13T12:00:00Z").weeks.completed).toBe(1);
  });

  it("handles an empty year without division by zero and rejects an invalid clock or zone", () => {
    const p = shortYear();
    p.academicYear.exclusions = [holiday("2026-09-07", "2026-09-18")];
    expect(progress(p, "2027-01-01T00:00:00Z")).toEqual({
      lessons: { total: 0, completed: 0, percentage: 0 },
      weeks: { total: 0, completed: 0, percentage: 0 },
    });
    expect(progress(p, "invalid")).toBeNull();
    p.academicYear.timezone = "Invalid/Zone";
    expect(progress(p, "2027-01-01T00:00:00Z")).toBeNull();
  });
});
