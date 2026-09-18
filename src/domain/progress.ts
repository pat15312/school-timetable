import { validTime, validTimezone } from "./dates";
import type { TimetableProject } from "./model";
import type { Occurrence } from "./occurrences";
import type { TeachingWeek } from "./rotation";

function countProgress(completed: number, total: number) {
  return {
    completed,
    total,
    // Avoid showing 100% before the final lesson or week has ended.
    percentage: total ? Math.floor((completed * 1000) / total) / 10 : 0,
  };
}

/** Compare school-local dates/times so travelling does not change progress. */
export function getYearProgress(
  project: TimetableProject,
  occurrences: Occurrence[],
  weeks: TeachingWeek[],
  now: Date,
) {
  if (
    !validTimezone(project.academicYear.timezone) ||
    !Number.isFinite(now.getTime())
  )
    return null;
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: project.academicYear.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((value) => value.type === type)!.value;
  const date = `${part("year")}-${part("month")}-${part("day")}`;
  const time = `${part("hour")}:${part("minute")}`;
  const ended = (endDate: string, endTime: string) =>
    endDate < date || (endDate === date && endTime <= time);
  const lessons = occurrences.filter((event) => !event.structural);
  const schoolDayEnd = project.periods
    .map((period) => period.endTime)
    .filter(validTime)
    .sort()
    .at(-1);

  return {
    lessons: countProgress(
      lessons.filter((lesson) => ended(lesson.date, lesson.endTime)).length,
      lessons.length,
    ),
    weeks: countProgress(
      schoolDayEnd
        ? weeks.filter((week) => {
            const lastDay = week.dates.at(-1);
            return lastDay && ended(lastDay, schoolDayEnd);
          }).length
        : 0,
      weeks.length,
    ),
  };
}
