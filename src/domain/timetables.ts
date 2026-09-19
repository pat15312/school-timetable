import { z } from "zod";
import { createProject, newId, type TimetableProject } from "./model";
import { parseProject, serializeProject, STORAGE_KEY } from "./persistence";

export const TIMETABLES_KEY = "schoolcal.timetables.v1";
export const RECOVERY_KEY = "schoolcal.timetables.recovery";
const librarySchema = z.object({
  schemaVersion: z.literal(1),
  activeId: z.string(),
  timetables: z.array(z.unknown()).min(1),
  preferences: z
    .record(z.string(), z.object({ includeFixedPeriods: z.boolean() }))
    .default({}),
});
export interface TimetableLibrary {
  schemaVersion: 1;
  activeId: string;
  timetables: TimetableProject[];
  preferences: Record<string, { includeFixedPeriods: boolean }>;
}

export function createLibrary(project = createProject()): TimetableLibrary {
  return {
    schemaVersion: 1,
    activeId: project.id,
    timetables: [project],
    preferences: {},
  };
}

export function activeTimetable(library: TimetableLibrary): TimetableProject {
  const project = library.timetables.find((p) => p.id === library.activeId);
  if (!project) throw new Error("The active timetable could not be found.");
  return project;
}

export function parseLibrary(raw: string): TimetableLibrary {
  const data = librarySchema.parse(JSON.parse(raw));
  const timetables = data.timetables.map((timetable) =>
    parseProject(JSON.stringify({ schemaVersion: 2, timetable })),
  );
  if (new Set(timetables.map((p) => p.id)).size !== timetables.length)
    throw new Error("Saved timetables contain duplicate IDs.");
  const library = { ...data, timetables };
  activeTimetable(library);
  return library;
}

export function readLibrary(storage: Pick<Storage, "getItem">) {
  let raw: string | null = null;
  let savedRaw: string | null = null;
  try {
    savedRaw = storage.getItem(TIMETABLES_KEY);
    raw = savedRaw;
    if (raw !== null)
      return { library: parseLibrary(raw), raw, savedRaw, error: null };
    raw = storage.getItem(STORAGE_KEY);
    // Keep the original single-project data untouched, including on failed writes.
    return {
      library: createLibrary(raw === null ? undefined : parseProject(raw)),
      raw,
      savedRaw,
      error: null,
    };
  } catch {
    return {
      library: createLibrary(),
      raw,
      savedRaw,
      error:
        "Your saved timetable could not be opened. Download the saved data before starting again, or restore a project backup.",
    };
  }
}

export function saveLibrary(
  storage: Pick<Storage, "getItem" | "setItem">,
  library: TimetableLibrary,
  expectedRaw: string | null,
): string {
  if (storage.getItem(TIMETABLES_KEY) !== expectedRaw)
    throw new Error(
      "Timetables changed in another tab. Download a backup of your edits, then reload to see the saved timetables.",
    );
  const raw = JSON.stringify(library);
  // One atomic write saves both every timetable and the active selection.
  storage.setItem(TIMETABLES_KEY, raw);
  return raw;
}

export function updateTimetable(
  library: TimetableLibrary,
  project: TimetableProject,
): TimetableLibrary {
  return {
    ...library,
    timetables: library.timetables.map((p) =>
      p.id === project.id ? project : p,
    ),
  };
}

export function selectTimetable(
  library: TimetableLibrary,
  id: string,
): TimetableLibrary {
  const next = { ...library, activeId: id };
  activeTimetable(next);
  return next;
}

function pristine(project: TimetableProject): boolean {
  const blank = createProject();
  return (
    serializeProject(project) ===
    serializeProject({
      ...blank,
      // Older untouched starters had an empty name.
      name: project.name === "" ? "" : blank.name,
      id: project.id,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    })
  );
}

export function addTimetable(
  library: TimetableLibrary,
  project = createProject(),
): TimetableLibrary {
  // A received copy keeps its calendar identity unless it already exists here.
  const added = structuredClone(project);
  if (library.timetables.some((p) => p.id === added.id)) added.id = newId();
  const current = activeTimetable(library);
  const replaceBlank =
    pristine(current) && !library.preferences[current.id]?.includeFixedPeriods;
  const timetables = replaceBlank
    ? library.timetables.filter((p) => p.id !== current.id)
    : library.timetables;
  return { ...library, activeId: added.id, timetables: [...timetables, added] };
}

export function duplicateTimetable(
  library: TimetableLibrary,
  id: string,
): TimetableLibrary {
  const original = activeTimetable(selectTimetable(library, id));
  const copy = structuredClone(original);
  copy.id = newId();
  copy.name = `${(original.name || "Untitled timetable").slice(0, 493)} (copy)`;
  copy.createdAt = copy.updatedAt = new Date().toISOString();
  return {
    ...library,
    activeId: copy.id,
    timetables: [...library.timetables, copy],
    preferences: {
      ...library.preferences,
      [copy.id]: {
        includeFixedPeriods:
          library.preferences[id]?.includeFixedPeriods ?? false,
      },
    },
  };
}

export function deleteTimetable(
  library: TimetableLibrary,
  id: string,
): TimetableLibrary {
  const index = library.timetables.findIndex((p) => p.id === id);
  if (index < 0) return library;
  const timetables = library.timetables.filter((p) => p.id !== id);
  if (!timetables.length) return createLibrary();
  const preferences = { ...library.preferences };
  delete preferences[id];
  return {
    ...library,
    timetables,
    preferences,
    activeId:
      library.activeId === id
        ? timetables[Math.min(index, timetables.length - 1)].id
        : library.activeId,
  };
}
