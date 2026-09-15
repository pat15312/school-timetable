import { useCallback, useEffect, useRef, useState } from "react";
import {
  createProject,
  type TimetableEntry,
  type TimetableProject,
} from "../domain/model";
import { readProject, saveProject } from "../domain/persistence";

function initialData() {
  try {
    return readProject(window.localStorage);
  } catch {
    return {
      project: null,
      error:
        "Device storage is unavailable. Restore a backup, or start a timetable and download a backup before leaving.",
      raw: null,
    };
  }
}
export function useProject() {
  const [initial] = useState(initialData);
  const [project, setProject] = useState<TimetableProject>(
    () => initial.project ?? createProject(),
  );
  const [saveState, setSaveState] = useState<"saved" | "saving" | "error">(
    "saving",
  );
  const [recoveryError, setRecoveryError] = useState(initial.error);
  const history = useRef<TimetableEntry[][]>([]);
  const [historyLength, setHistoryLength] = useState(0);
  const current = useRef(project);
  const update = useCallback(
    (change: (p: TimetableProject) => TimetableProject) => {
      const next = {
        ...change(current.current),
        updatedAt: new Date().toISOString(),
      };
      current.current = next;
      setProject(next);
      setSaveState("saving");
    },
    [],
  );
  const editEntries = useCallback(
    (change: (entries: TimetableEntry[]) => TimetableEntry[]) => {
      history.current = [
        ...history.current.slice(-79),
        current.current.entries,
      ];
      setHistoryLength(history.current.length);
      update((p) => ({ ...p, entries: change(p.entries) }));
    },
    [update],
  );
  const undo = useCallback(() => {
    const snapshot = history.current.pop();
    if (!snapshot) return;
    const p = current.current;
    const entries = snapshot.filter(
      (e) =>
        p.subjects.some((s) => s.id === e.subjectId) &&
        p.periods.some((period) => period.id === e.periodId),
    );
    setHistoryLength(history.current.length);
    update((p) => ({ ...p, entries }));
  }, [update]);
  const replace = useCallback((p: TimetableProject) => {
    setRecoveryError(null);
    history.current = [];
    setHistoryLength(0);
    current.current = p;
    setProject(p);
    setSaveState("saving");
  }, []);
  useEffect(() => {
    if (recoveryError) return;
    const save = () => {
      try {
        setSaveState(
          saveProject(window.localStorage, current.current) ? "saved" : "error",
        );
      } catch {
        setSaveState("error");
      }
    };
    // Synchronous local saving ensures edits survive an immediate close or reload.
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
  }, [project, recoveryError]);
  return {
    project,
    update,
    replace,
    editEntries,
    undo,
    canUndo: historyLength > 0,
    saveState,
    recoveryError,
    recoveryRaw: initial.raw,
  };
}
