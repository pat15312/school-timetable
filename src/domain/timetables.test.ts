import { describe, expect, it } from "vitest";
import { buildCalendar } from "./calendar";
import { createProject } from "./model";
import { parseProject, serializeProject, STORAGE_KEY } from "./persistence";
import { testProject } from "./test-helpers";
import { decodeTransfer, encodeTransfer } from "./transfer";
import {
  activeTimetable,
  addTimetable,
  createLibrary,
  deleteTimetable,
  duplicateTimetable,
  parseLibrary,
  readLibrary,
  saveLibrary,
  selectTimetable,
  TIMETABLES_KEY,
  updateTimetable,
} from "./timetables";

function memory() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
  };
}

describe("timetable collection persistence", () => {
  it.each([1, 2])(
    "migrates version %i without changing any project fields or the original saved data",
    (version) => {
      const p = { ...testProject(), setupComplete: false, setupStep: 4 };
      const { periodCategories: _, ...legacy } = p;
      const raw =
        version === 2
          ? serializeProject(p)
          : JSON.stringify({
              schemaVersion: 1,
              timetable: {
                ...legacy,
                periods: p.periods.map(({ categoryId, ...period }) => ({
                  ...period,
                  type: categoryId,
                })),
              },
            });
      const storage = memory();
      storage.setItem(STORAGE_KEY, raw);
      const initial = readLibrary(storage);
      expect(initial.error).toBeNull();
      expect(activeTimetable(initial.library)).toEqual(parseProject(raw));
      saveLibrary(storage, initial.library, initial.savedRaw);
      expect(readLibrary(storage).library).toEqual(initial.library);
      expect(storage.getItem(STORAGE_KEY)).toBe(raw);
    },
  );

  it("saves all edits, per-timetable settings, setup progress and active selection across reopening", () => {
    const a = testProject();
    let library = createLibrary(a);
    library = addTimetable(library);
    const b = { ...activeTimetable(library), name: "Draft B", setupStep: 3 };
    library = updateTimetable(library, b);
    library.preferences[b.id] = { includeFixedPeriods: true };
    library = selectTimetable(library, a.id);
    expect(activeTimetable(library)).toEqual(a);
    const storage = memory();
    let raw = saveLibrary(storage, library, null);
    library = selectTimetable(readLibrary(storage).library, b.id);
    expect(activeTimetable(library)).toEqual(b);
    raw = saveLibrary(storage, library, raw);
    expect(readLibrary(storage).savedRaw).toBe(raw);
    expect(readLibrary(storage).library).toEqual(library);
  });

  it("does not fall back to stale legacy data when the collection is corrupt", () => {
    const storage = memory();
    storage.setItem(STORAGE_KEY, serializeProject(testProject()));
    for (const raw of [
      "",
      "{broken",
      JSON.stringify({ ...createLibrary(), activeId: "missing" }),
    ]) {
      storage.setItem(TIMETABLES_KEY, raw);
      const result = readLibrary(storage);
      expect(result.error).toBeTruthy();
      expect(result.raw).toBe(raw);
      expect(storage.getItem(TIMETABLES_KEY)).toBe(raw);
    }
  });

  it("failed migration and collection writes preserve existing data", () => {
    const storage = memory();
    const legacy = serializeProject(testProject());
    storage.setItem(STORAGE_KEY, legacy);
    const loaded = readLibrary(storage);
    const full = {
      ...storage,
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
    };
    expect(() => saveLibrary(full, loaded.library, null)).toThrow("Quota");
    expect(storage.getItem(STORAGE_KEY)).toBe(legacy);
    expect(storage.getItem(TIMETABLES_KEY)).toBeNull();
    const raw = saveLibrary(storage, loaded.library, null);
    expect(() => saveLibrary(full, addTimetable(loaded.library), raw)).toThrow(
      "Quota",
    );
    expect(storage.getItem(TIMETABLES_KEY)).toBe(raw);
    expect(
      readLibrary({
        getItem: () => {
          throw new Error("Denied");
        },
      }).error,
    ).toBeTruthy();
  });

  it("refuses a stale tab's writes instead of overwriting saved timetables", () => {
    const storage = memory();
    const library = createLibrary(testProject());
    const raw = saveLibrary(storage, library, null);
    const newer = addTimetable(library);
    saveLibrary(storage, newer, raw);
    expect(() => saveLibrary(storage, library, raw)).toThrow("another tab");
    expect(readLibrary(storage).library).toEqual(newer);
  });

  it("rejects duplicate timetable identities and invalid data inside any timetable", () => {
    const library = createLibrary(testProject());
    library.timetables.push(structuredClone(library.timetables[0]));
    expect(() => parseLibrary(JSON.stringify(library))).toThrow("duplicate");
    library.timetables[1].id = "second";
    library.timetables[1].entries[0].subjectId = "missing";
    expect(() => parseLibrary(JSON.stringify(library))).toThrow("missing");
  });
});

describe("timetable operations", () => {
  it("duplicates deeply, retains setup and preferences, and gives every calendar event a different UID", () => {
    const original = { ...testProject(), setupComplete: false, setupStep: 5 };
    const library = createLibrary(original);
    library.preferences[original.id] = { includeFixedPeriods: true };
    const next = duplicateTimetable(library, original.id);
    const copy = activeTimetable(next);
    expect(copy.id).not.toBe(original.id);
    expect(copy.setupStep).toBe(5);
    expect(copy.setupComplete).toBe(false);
    expect(next.preferences[copy.id]).toEqual({ includeFixedPeriods: true });
    const uids = (p: typeof original) =>
      [...buildCalendar(p).matchAll(/^UID:(.+)$/gm)].map((m) => m[1]);
    const originalUids = new Set(uids(original));
    expect(uids(copy).some((uid) => originalUids.has(uid))).toBe(false);
    copy.subjects[0].teacher = "Another teacher";
    copy.entries[0].notes = "Only this copy";
    copy.academicYear.schoolWeekdays.pop();
    expect(library.timetables[0]).toEqual(original);
    expect(original.entries[0].notes).not.toBe("Only this copy");
    expect(original.subjects[0].teacher).not.toBe("Another teacher");
    expect(original.academicYear.schoolWeekdays).toHaveLength(5);
  });

  it("deletes inactive, active and last timetables sensibly, without touching other projects", () => {
    const a = testProject();
    const library = addTimetable(createLibrary(a));
    const b = activeTimetable(library);
    expect(activeTimetable(deleteTimetable(library, a.id))).toEqual(b);
    const remaining = deleteTimetable(library, b.id);
    expect(remaining.timetables).toEqual([a]);
    expect(remaining.activeId).toBe(a.id);
    const empty = deleteTimetable(remaining, a.id);
    expect(empty.timetables).toHaveLength(1);
    expect(activeTimetable(empty)).toMatchObject({
      name: "",
      entries: [],
      setupComplete: false,
      setupStep: 0,
    });
    expect(empty.activeId).not.toBe(a.id);
  });

  it("reuses only a completely untouched blank and preserves unnamed drafts with settings", () => {
    const received = testProject();
    expect(addTimetable(createLibrary(), received).timetables).toEqual([
      received,
    ]);
    for (const change of [
      { setupStep: 2 },
      { cycleLength: 2 as const },
      {
        academicYear: {
          ...createProject().academicYear,
          endDate: "2027-07-16",
        },
      },
    ]) {
      const draft = { ...createProject(), ...change };
      expect(addTimetable(createLibrary(draft), received).timetables).toEqual([
        draft,
        received,
      ]);
    }
  });

  it.each(["backup", "transfer"])(
    "adds a %s, preserving all existing work even if the identity matches",
    async (kind) => {
      const original = testProject();
      const incoming =
        kind === "backup"
          ? parseProject(serializeProject(original))
          : await decodeTransfer(await encodeTransfer(original));
      const library = addTimetable(createLibrary(original), incoming);
      expect(library.timetables[0]).toEqual(original);
      expect(activeTimetable(library)).toEqual({
        ...incoming,
        id: library.activeId,
      });
      expect(library.activeId).not.toBe(original.id);
      expect(library.timetables).toHaveLength(2);
      const elsewhere = addTimetable(createLibrary(), incoming);
      expect(activeTimetable(elsewhere).id).toBe(original.id);
    },
  );
});
