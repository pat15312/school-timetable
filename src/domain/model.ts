import { z } from "zod";

const id = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[a-zA-Z0-9_-]+$/);
const text = z.string().max(500);
const date = z.string().max(10);
export const exclusionSchema = z.object({
  id,
  name: text,
  startDate: date,
  endDate: date,
  resetRotationAfter: z.boolean(),
});
export const periodCategorySchema = z.object({
  id,
  name: z.string().trim().min(1).max(80),
  allowSubjects: z.boolean(),
});
export const periodSchema = z.object({
  id,
  name: text,
  startTime: z.string().max(5),
  endTime: z.string().max(5),
  categoryId: id,
  sortOrder: z.number().int().min(0).max(100),
});
export const subjectSchema = z.object({
  id,
  name: text,
  shortName: text.optional(),
  teacher: text.optional(),
  room: text.optional(),
  colour: z.string().regex(/^#[0-9a-fA-F]{6}$/),
});
export const entrySchema = z.object({
  id,
  rotationIndex: z.number().int().min(0).max(3),
  weekday: z.number().int().min(0).max(6),
  periodId: id,
  subjectId: id,
  titleOverride: text.optional(),
  teacherOverride: text.optional(),
  roomOverride: text.optional(),
  notes: z.string().max(4000).optional(),
});
export const projectSchema = z.object({
  id,
  name: text,
  academicYear: z.object({
    startDate: date,
    endDate: date,
    schoolWeekdays: z.array(z.number().int().min(0).max(6)).max(7),
    timezone: z.string().min(1).max(100),
    exclusions: z.array(exclusionSchema).max(200),
  }),
  cycleLength: z.union([
    z.literal(1),
    z.literal(2),
    z.literal(3),
    z.literal(4),
  ]),
  rotationLabelStyle: z.enum(["letters", "numbers"]),
  initialRotationIndex: z.number().int().min(0).max(3),
  periodCategories: z.array(periodCategorySchema).max(40),
  periods: z.array(periodSchema).max(40),
  subjects: z.array(subjectSchema).max(100),
  entries: z.array(entrySchema).max(1120),
  setupComplete: z.boolean(),
  setupStep: z.number().int().min(0).max(6),
  createdAt: z.string().max(40),
  updatedAt: z.string().max(40),
});

export type TimetableProject = z.infer<typeof projectSchema>;
export type DateExclusion = z.infer<typeof exclusionSchema>;
export type Period = z.infer<typeof periodSchema>;
export type PeriodCategory = z.infer<typeof periodCategorySchema>;
export type Subject = z.infer<typeof subjectSchema>;
export type TimetableEntry = z.infer<typeof entrySchema>;
export type RotationLabelStyle = TimetableProject["rotationLabelStyle"];
export type Cell = Pick<
  TimetableEntry,
  "rotationIndex" | "weekday" | "periodId"
>;
export const newId = () => crypto.randomUUID();
export const WEEKDAYS = [1, 2, 3, 4, 5, 6, 0];
export const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
export const COLOURS = [
  "#6484ba",
  "#b07e9c",
  "#679783",
  "#ac945f",
  "#8a80b1",
  "#be8268",
  "#689ca6",
  "#a58062",
];
export const schoolDays = (p: TimetableProject) =>
  WEEKDAYS.filter((d) => p.academicYear.schoolWeekdays.includes(d));
export const sortedPeriods = (p: TimetableProject) =>
  [...p.periods].sort((a, b) => a.sortOrder - b.sortOrder);
export const isStructural = (
  period: Period,
  project: Pick<TimetableProject, "periodCategories">,
) =>
  !project.periodCategories.find(
    (category) => category.id === period.categoryId,
  )?.allowSubjects;
export const defaultPeriodCategories = (): PeriodCategory[] => [
  { id: "lesson", name: "Lesson", allowSubjects: true },
  { id: "registration", name: "Registration", allowSubjects: false },
  { id: "break", name: "Break", allowSubjects: false },
  { id: "lunch", name: "Lunch", allowSubjects: false },
];
export const sameCell = (a: Cell, b: Cell) =>
  a.rotationIndex === b.rotationIndex &&
  a.weekday === b.weekday &&
  a.periodId === b.periodId;
export const cellKey = (c: Cell) =>
  `${c.rotationIndex}-${c.weekday}-${c.periodId}`;

export function createProject(): TimetableProject {
  const now = new Date().toISOString();
  return {
    id: newId(),
    name: "Untitled timetable",
    academicYear: {
      startDate: "",
      endDate: "",
      schoolWeekdays: [1, 2, 3, 4, 5],
      timezone:
        Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/London",
      exclusions: [],
    },
    cycleLength: 1,
    rotationLabelStyle: "numbers",
    initialRotationIndex: 0,
    periodCategories: defaultPeriodCategories(),
    periods: [],
    subjects: [],
    entries: [],
    setupComplete: false,
    setupStep: 0,
    createdAt: now,
    updatedAt: now,
  };
}
