import { z } from "zod";
import {
  cellKey,
  defaultPeriodCategories,
  periodSchema,
  projectSchema,
  type TimetableProject,
} from "./model";
export const STORAGE_KEY = "schoolcal.project.v1";
export const SCHEMA_VERSION = 2;
const legacyProjectSchema = projectSchema
  .omit({ periodCategories: true })
  .extend({
    periods: z
      .array(
        periodSchema.omit({ categoryId: true }).extend({
          type: z.enum(["lesson", "registration", "break", "lunch", "other"]),
        }),
      )
      .max(40),
  });
const envelopeSchema = z.discriminatedUnion("schemaVersion", [
  z.object({ schemaVersion: z.literal(1), timetable: legacyProjectSchema }),
  z.object({
    schemaVersion: z.literal(SCHEMA_VERSION),
    timetable: projectSchema,
  }),
]);
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
      "This is not a supported SchoolCal project backup (versions 1 or 2). Your timetable has not been changed.",
    );
  const p: TimetableProject =
    result.data.schemaVersion === 1
      ? {
          ...result.data.timetable,
          periodCategories: defaultPeriodCategories(),
          // Other allowed subjects, just like Lesson. Keep its period names,
          // IDs and entries while removing the old catch-all dropdown option.
          periods: result.data.timetable.periods.map(({ type, ...period }) => ({
            ...period,
            categoryId: type === "other" ? "lesson" : type,
          })),
        }
      : result.data.timetable;
  for (const records of [
    p.periodCategories,
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
    new Set(p.periodCategories.map((category) => category.name.toLowerCase()))
      .size !== p.periodCategories.length
  )
    throw new Error("This backup contains duplicate period category names.");
  if (
    p.periods.some(
      (period) =>
        !p.periodCategories.some(
          (category) => category.id === period.categoryId,
        ),
    )
  )
    throw new Error("This backup refers to a missing period category.");
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
