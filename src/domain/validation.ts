import { cellKey, isStructural, type TimetableProject } from "./model";
import { daysBetween, validDate, validTime, validTimezone } from "./dates";
export interface Validation {
  errors: string[];
  warnings: string[];
}
export function validateProject(
  p: TimetableProject,
  requireLessons = true,
): Validation {
  const errors: string[] = [],
    warnings: string[] = [];
  const a = p.academicYear;
  if (!p.name.trim()) errors.push("Give your timetable a name.");
  if (!validDate(a.startDate) || !validDate(a.endDate))
    errors.push("Enter valid school year dates (1900–2200).");
  else if (a.endDate <= a.startDate)
    errors.push("The school year must end after it starts.");
  else if (daysBetween(a.startDate, a.endDate) > 1096)
    errors.push("Choose a school year spanning no more than three years.");
  if (!a.schoolWeekdays.length) errors.push("Choose at least one school day.");
  if (
    new Set(a.schoolWeekdays).size !== a.schoolWeekdays.length ||
    a.schoolWeekdays.some((d) => !Number.isInteger(d) || d < 0 || d > 6)
  )
    errors.push("Check the selected school days.");
  if (!validTimezone(a.timezone))
    errors.push("Choose a valid school time zone.");
  if (
    ![1, 2, 3, 4].includes(p.cycleLength) ||
    p.initialRotationIndex < 0 ||
    p.initialRotationIndex >= p.cycleLength ||
    !Number.isInteger(p.initialRotationIndex)
  )
    errors.push("Choose a valid first timetable week.");
  if (!p.periods.length) errors.push("Add at least one lesson period.");
  if (p.periodCategories.some((category) => !category.name.trim()))
    errors.push("Give each period category a name.");
  if (
    new Set(
      p.periodCategories.map((category) => category.name.trim().toLowerCase()),
    ).size !== p.periodCategories.length
  )
    errors.push("Use a different name for each period category.");
  if (
    p.periods.some(
      (period) =>
        !p.periodCategories.some(
          (category) => category.id === period.categoryId,
        ),
    )
  )
    errors.push("Some periods reference a missing category.");
  for (const period of p.periods) {
    if (!period.name.trim()) errors.push("Give each period a label.");
    if (
      !validTime(period.startTime) ||
      !validTime(period.endTime) ||
      period.endTime <= period.startTime
    )
      errors.push(
        `${period.name || "Period"} must end after it starts, on the same day.`,
      );
  }
  const byTime = [...p.periods].sort((x, y) =>
    x.startTime.localeCompare(y.startTime),
  );
  if (
    byTime.some(
      (period, i) => i > 0 && period.startTime < byTime[i - 1].endTime,
    )
  )
    warnings.push("Some periods overlap. Check your lesson times.");
  const exclusions = [...a.exclusions].sort((x, y) =>
    x.startDate.localeCompare(y.startDate),
  );
  for (let i = 0; i < exclusions.length; i++) {
    const e = exclusions[i];
    if (
      !validDate(e.startDate) ||
      !validDate(e.endDate) ||
      e.endDate < e.startDate
    )
      errors.push(`${e.name || "Holiday"} needs a valid date range.`);
    if (!e.name.trim()) errors.push("Give each holiday or day off a name.");
    if (e.startDate < a.startDate || e.endDate > a.endDate)
      warnings.push(
        `${e.name} extends outside the school year. Only dates within the year affect your calendar.`,
      );
    if (exclusions.slice(0, i).some((other) => other.endDate >= e.startDate))
      warnings.push(
        `${e.name} overlaps another holiday. These dates will be excluded once.`,
      );
  }
  if (p.subjects.some((s) => !s.name.trim()))
    errors.push("Give each subject a name.");
  const subjects = new Set(p.subjects.map((s) => s.id)),
    periods = new Set(p.periods.map((s) => s.id));
  if (
    p.entries.some(
      (e) => !subjects.has(e.subjectId) || !periods.has(e.periodId),
    )
  )
    errors.push("Some lessons reference a missing subject or period.");
  if (
    p.entries.some(
      (e) => e.titleOverride !== undefined && !e.titleOverride.trim(),
    )
  )
    errors.push(
      "A lesson title override is empty. Add a title or use its subject default.",
    );
  if (new Set(p.entries.map(cellKey)).size !== p.entries.length)
    errors.push("There are duplicate entries in a timetable cell.");
  const active = p.entries.filter(
    (e) =>
      e.rotationIndex < p.cycleLength &&
      a.schoolWeekdays.includes(e.weekday) &&
      p.periods.some(
        (period) => period.id === e.periodId && !isStructural(period, p),
      ) &&
      subjects.has(e.subjectId),
  );
  if (requireLessons && !active.length)
    errors.push("Place at least one subject in your timetable.");
  return { errors: [...new Set(errors)], warnings: [...new Set(warnings)] };
}
