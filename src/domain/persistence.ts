import { z } from "zod";
import { cellKey, projectSchema, type TimetableProject } from "./model";
export const STORAGE_KEY = "schoolcal.project.v1";
export const SCHEMA_VERSION = 1;
const envelopeSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  timetable: projectSchema,
});
export function serializeProject(project: TimetableProject): string {
  return JSON.stringify(
    { schemaVersion: SCHEMA_VERSION, timetable: project },
    null,
    2,
  );
}
export function parseProject(text: string): TimetableProject {
  if (text.length > 2_000_000)
    throw new Error(
      "This file is too large. Choose a SchoolCal project backup under 2 MB.",
    );
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(
      "This file is not valid JSON. Choose a SchoolCal project backup.",
    );
  }
  const result = envelopeSchema.safeParse(data);
  if (!result.success)
    throw new Error(
      "This is not a supported SchoolCal project backup (version 1). Your timetable has not been changed.",
    );
  const p = result.data.timetable;
  for (const records of [
    p.periods,
    p.subjects,
    p.entries,
    p.academicYear.exclusions,
  ]) {
    if (new Set(records.map((r) => r.id)).size !== records.length)
      throw new Error(
        "This backup contains duplicate IDs. Your timetable has not been changed.",
      );
  }
  if (new Set(p.entries.map(cellKey)).size !== p.entries.length)
    throw new Error("This backup contains duplicate timetable cells.");
  if (
    p.entries.some(
      (e) =>
        !p.subjects.some((s) => s.id === e.subjectId) ||
        !p.periods.some((period) => period.id === e.periodId),
    )
  )
    throw new Error("This backup refers to a missing subject or period.");
  return p;
}
export function readProject(storage: Pick<Storage, "getItem">): {
  project: TimetableProject | null;
  error: string | null;
  raw: string | null;
} {
  let raw: string | null = null;
  try {
    raw = storage.getItem(STORAGE_KEY);
    return { project: raw ? parseProject(raw) : null, error: null, raw };
  } catch {
    return {
      project: null,
      error:
        "Your saved timetable could not be opened. Download the saved data before starting again, or restore a project backup.",
      raw,
    };
  }
}
export function saveProject(
  storage: Pick<Storage, "setItem">,
  project: TimetableProject,
): boolean {
  try {
    storage.setItem(STORAGE_KEY, serializeProject(project));
    return true;
  } catch {
    return false;
  }
}
