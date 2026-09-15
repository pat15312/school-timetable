import { BRAND } from "../brand";
import { weekday } from "./dates";
import {
  cellKey,
  isStructural,
  sortedPeriods,
  type Subject,
  type TimetableEntry,
  type TimetableProject,
} from "./model";
import { getTeachingWeeks } from "./rotation";
import { validateProject } from "./validation";

export interface Occurrence {
  uid: string;
  date: string;
  startTime: string;
  endTime: string;
  title: string;
  room: string;
  teacher: string;
  notes: string;
  colour: string;
  rotationIndex: number;
  structural: boolean;
}
export function resolveEntry(entry: TimetableEntry, subject: Subject) {
  return {
    title: entry.titleOverride ?? subject.name,
    teacher: entry.teacherOverride ?? subject.teacher ?? "",
    room: entry.roomOverride ?? subject.room ?? "",
    notes: entry.notes ?? "",
    colour: subject.colour,
  };
}
export function generateOccurrences(
  project: TimetableProject,
  includeBreaks = false,
): Occurrence[] {
  if (validateProject(project).errors.length) return [];
  const entries = new Map(project.entries.map((e) => [cellKey(e), e]));
  const subjects = new Map(project.subjects.map((s) => [s.id, s]));
  const events: Occurrence[] = [];
  for (const week of getTeachingWeeks(project)) {
    for (const date of week.dates) {
      const day = weekday(date);
      for (const period of sortedPeriods(project)) {
        const entry = entries.get(
          cellKey({
            rotationIndex: week.rotationIndex,
            weekday: day,
            periodId: period.id,
          }),
        );
        const subject = entry && subjects.get(entry.subjectId);
        const structural = isStructural(period);
        if (structural ? !includeBreaks : !entry || !subject) continue;
        const details = structural
          ? {
              title: period.name,
              teacher: "",
              room: "",
              notes: "",
              colour: "#8c938c",
            }
          : resolveEntry(entry!, subject!);
        // Length-delimited components prevent ambiguous UID concatenation.
        const uid =
          [
            project.id,
            date,
            String(day),
            period.id,
            structural ? period.type : subject!.id,
          ]
            .map((part) => `${part.length}_${part}`)
            .join("-") +
          "@" +
          BRAND.uidDomain;
        events.push({
          uid,
          date,
          startTime: period.startTime,
          endTime: period.endTime,
          ...details,
          rotationIndex: week.rotationIndex,
          structural,
        });
      }
    }
  }
  return events.sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      a.startTime.localeCompare(b.startTime) ||
      a.uid.localeCompare(b.uid),
  );
}
