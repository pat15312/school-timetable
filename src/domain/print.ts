import {
  isStructural,
  schoolDays,
  sortedPeriods,
  type TimetableProject,
} from "./model";
import { resolveEntry } from "./occurrences";
import { getRotationLabel } from "./rotation";
export type PrintLayout = "landscape" | "portrait";
export function preparePrintPages(
  project: TimetableProject,
  layout: PrintLayout,
) {
  const weeks = Array.from({ length: project.cycleLength }, (_, index) => ({
    index,
    label: getRotationLabel(index, project.rotationLabelStyle),
    days: schoolDays(project),
    rows: sortedPeriods(project).map((period) => ({
      period,
      structural: isStructural(period, project),
      cells: schoolDays(project).map((day) => {
        const entry = project.entries.find(
          (e) =>
            e.rotationIndex === index &&
            e.weekday === day &&
            e.periodId === period.id,
        );
        const subject =
          entry && project.subjects.find((s) => s.id === entry.subjectId);
        return entry && subject && !isStructural(period, project)
          ? resolveEntry(entry, subject)
          : null;
      }),
    })),
  }));
  const perPage = layout === "landscape" ? 1 : 2;
  return Array.from({ length: Math.ceil(weeks.length / perPage) }, (_, page) =>
    weeks.slice(page * perPage, (page + 1) * perPage),
  );
}
