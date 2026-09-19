import { useCallback, useEffect, useRef, useState } from "react";
import { type TimetableEntry, type TimetableProject } from "../domain/model";
import {
  activeTimetable,
  addTimetable,
  createLibrary,
  deleteTimetable,
  duplicateTimetable,
  readLibrary,
  RECOVERY_KEY,
  saveLibrary,
  selectTimetable,
  updateTimetable,
  type TimetableLibrary,
} from "../domain/timetables";

function initialData() {
  try {
    return readLibrary(window.localStorage);
  } catch {
    return {
      library: createLibrary(),
      raw: null,
      savedRaw: null,
      error:
        "Device storage is unavailable. Restore a backup, or start a timetable and download a backup before leaving.",
    };
  }
}

export function useProject() {
  const [initial] = useState(initialData);
  const [library, setLibrary] = useState(initial.library);
  const current = useRef(library);
  const savedRaw = useRef(initial.savedRaw);
  const recovery = useRef(initial.error);
  const [recoveryError, setRecoveryError] = useState(initial.error);
  const [saveError, setSaveError] = useState("");
  const [saveState, setSaveState] = useState<"saved" | "saving" | "error">(
    "saving",
  );
  const history = useRef<TimetableEntry[][]>([]);
  const [historyLength, setHistoryLength] = useState(0);

  const persist = useCallback(
    (next: TimetableLibrary, recover = false) => {
      if (recovery.current && !recover) return false;
      try {
        // Explicit recovery retains the unreadable collection before replacing it.
        if (recover && recovery.current && initial.savedRaw !== null)
          window.localStorage.setItem(RECOVERY_KEY, initial.savedRaw);
        savedRaw.current = saveLibrary(
          window.localStorage,
          next,
          savedRaw.current,
        );
        recovery.current = null;
        setRecoveryError(null);
        setSaveError("");
        setSaveState("saved");
        return true;
      } catch (error) {
        setSaveError(
          error instanceof Error && error.message.includes("another tab")
            ? error.message
            : "Your browser could not save your timetables. Keep this page open and download a backup of your edits before leaving.",
        );
        setSaveState("error");
        return false;
      }
    },
    [initial.savedRaw],
  );

  const update = useCallback(
    (change: (p: TimetableProject) => TimetableProject) => {
      const project = activeTimetable(current.current);
      const next = updateTimetable(current.current, {
        ...change(project),
        id: project.id,
        updatedAt: new Date().toISOString(),
      });
      current.current = next;
      setLibrary(next);
      // Save inside the edit, before another event can switch or close the page.
      persist(next);
    },
    [persist],
  );

  const commit = useCallback(
    (next: TimetableLibrary, recover = false) => {
      // Never leave the current timetable if its latest edits cannot be saved.
      if (!persist(next, recover)) return null;
      if (next.activeId !== current.current.activeId) {
        history.current = [];
        setHistoryLength(0);
      }
      current.current = next;
      setLibrary(next);
      return activeTimetable(next);
    },
    [persist],
  );

  const editEntries = useCallback(
    (change: (entries: TimetableEntry[]) => TimetableEntry[]) => {
      history.current = [
        ...history.current.slice(-79),
        activeTimetable(current.current).entries,
      ];
      setHistoryLength(history.current.length);
      update((p) => ({ ...p, entries: change(p.entries) }));
    },
    [update],
  );
  const undo = useCallback(() => {
    const snapshot = history.current.pop();
    if (!snapshot) return;
    setHistoryLength(history.current.length);
    update((p) => ({
      ...p,
      entries: snapshot.filter(
        (e) =>
          p.subjects.some((s) => s.id === e.subjectId) &&
          p.periods.some((period) => period.id === e.periodId),
      ),
    }));
  }, [update]);

  useEffect(() => {
    const save = () => {
      persist(current.current);
    };
    save();
    const onHide = () => {
      if (document.visibilityState === "hidden") save();
    };
    window.addEventListener("pagehide", save);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.removeEventListener("pagehide", save);
      document.removeEventListener("visibilitychange", onHide);
    };
  }, [persist]);

  const project = activeTimetable(library);
  return {
    project,
    timetables: library.timetables,
    update,
    editEntries,
    undo,
    canUndo: historyLength > 0,
    saveState,
    saveError,
    recoveryError,
    recoveryRaw: initial.raw,
    select: (id: string) => commit(selectTimetable(current.current, id)),
    add: (p?: TimetableProject) =>
      commit(addTimetable(current.current, p), !!recovery.current),
    duplicate: (id: string) => commit(duplicateTimetable(current.current, id)),
    remove: (id: string) => commit(deleteTimetable(current.current, id)),
    restart: () => commit(createLibrary(), true),
    rename: (id: string, name: string) => {
      const p = activeTimetable(selectTimetable(current.current, id));
      return commit(
        updateTimetable(current.current, {
          ...p,
          name: name.trim(),
          updatedAt: new Date().toISOString(),
        }),
      );
    },
    includeFixedPeriods:
      library.preferences[project.id]?.includeFixedPeriods ?? false,
    setIncludeFixedPeriods: (value: boolean) => {
      const next = {
        ...current.current,
        preferences: {
          ...current.current.preferences,
          [current.current.activeId]: { includeFixedPeriods: value },
        },
      };
      current.current = next;
      setLibrary(next);
      persist(next);
    },
  };
}
