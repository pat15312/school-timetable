import { useMemo } from "react";
import type { TimetableProject } from "../domain/model";
import { generateOccurrences } from "../domain/occurrences";
import { getTeachingWeeks } from "../domain/rotation";
import { validateProject } from "../domain/validation";

export function useCalendar(
  project: TimetableProject,
  includeFixedPeriods = false,
) {
  return useMemo(() => {
    const validation = validateProject(project);
    const occurrences = generateOccurrences(project, includeFixedPeriods);
    const lessons = occurrences.filter((event) => !event.structural);
    return {
      validation,
      occurrences,
      lessons,
      weeks: getTeachingWeeks(project),
      valid: !validation.errors.length && !!lessons.length,
    };
  }, [project, includeFixedPeriods]);
}
