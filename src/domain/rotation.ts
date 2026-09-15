import type {
  DateExclusion,
  RotationLabelStyle,
  TimetableProject,
} from "./model";
import { addDays, daysBetween, mondayOf, validDate, weekday } from "./dates";

export const getRotationLabel = (
  index: number,
  style: RotationLabelStyle,
): string =>
  `Week ${style === "letters" ? String.fromCharCode(65 + index) : index + 1}`;
export const isExcluded = (
  date: string,
  exclusions: DateExclusion[],
): boolean => exclusions.some((e) => date >= e.startDate && date <= e.endDate);
export function isTeachingDay(
  date: string,
  project: TimetableProject,
): boolean {
  const a = project.academicYear;
  return (
    date >= a.startDate &&
    date <= a.endDate &&
    a.schoolWeekdays.includes(weekday(date)) &&
    !isExcluded(date, a.exclusions)
  );
}
export interface TeachingWeek {
  startDate: string;
  dates: string[];
  rotationIndex: number;
}

/** A reset applies to the first teaching week whose first teaching day follows the exclusion.
 * A week already underway is never relabelled halfway through (or retroactively).
 * Holiday-only weeks are skipped completely. Overlapping exclusions are a union.
 */
export function getTeachingWeeks(project: TimetableProject): TeachingWeek[] {
  const a = project.academicYear;
  if (
    !validDate(a.startDate) ||
    !validDate(a.endDate) ||
    a.startDate > a.endDate ||
    daysBetween(a.startDate, a.endDate) > 1096
  )
    return [];
  const resets = a.exclusions
    .filter(
      (e) =>
        e.resetRotationAfter &&
        validDate(e.endDate) &&
        e.endDate >= a.startDate,
    )
    .sort(
      (x, y) =>
        x.endDate.localeCompare(y.endDate) ||
        x.startDate.localeCompare(y.startDate),
    );
  let nextRotation = project.initialRotationIndex;
  let resetCursor = 0;
  const weeks: TeachingWeek[] = [];
  for (
    let monday = mondayOf(a.startDate);
    monday <= a.endDate;
    monday = addDays(monday, 7)
  ) {
    const dates = Array.from({ length: 7 }, (_, i) =>
      addDays(monday, i),
    ).filter((date) => isTeachingDay(date, project));
    if (!dates.length) continue;
    while (
      resetCursor < resets.length &&
      dates[0] > resets[resetCursor].endDate
    ) {
      nextRotation = 0;
      resetCursor++;
    }
    weeks.push({ startDate: monday, dates, rotationIndex: nextRotation });
    nextRotation = (nextRotation + 1) % project.cycleLength;
  }
  return weeks;
}
