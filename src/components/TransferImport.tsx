import { useEffect, useState } from "react";
import type { TimetableProject } from "../domain/model";
import { decodeTransfer } from "../domain/transfer";
import { Modal, Notice } from "./ui";

export function TransferImport({
  hash,
  hasCurrent,
  onImport,
  onBackup,
  onClose,
  saveError,
}: {
  hash: string;
  saveError: string;
  hasCurrent: boolean;
  onImport: (project: TimetableProject) => void;
  onBackup: () => void;
  onClose: () => void;
}) {
  const [project, setProject] = useState<TimetableProject | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setProject(null);
    setError("");
    void decodeTransfer(hash).then(
      (p) => {
        if (active) setProject(p);
      },
      (e) => {
        if (active)
          setError(
            e instanceof Error
              ? e.message
              : "This timetable could not be opened.",
          );
      },
    );
    return () => {
      active = false;
    };
  }, [hash]);
  return (
    <Modal title="Continue with this timetable?" onClose={onClose}>
      {saveError && <Notice kind="error">{saveError}</Notice>}
      {error && <Notice kind="error">{error}</Notice>}
      {!project && !error && (
        <p role="status">Opening the timetable from your link…</p>
      )}
      {project && (
        <>
          <h3>{project.name || "Untitled timetable"}</h3>
          <p>
            {project.cycleLength}-week cycle · {project.subjects.length}{" "}
            subjects · {project.entries.length} lesson slots
          </p>
          <p>
            Your subjects, lesson times, holidays and lesson details will be
            saved on this device so you can continue editing.
          </p>
          {hasCurrent && (
            <Notice>
              This adds a separate timetable. Your saved timetables will be
              kept.
              <div className="notice-actions">
                <button className="button secondary" onClick={onBackup}>
                  Back up current timetable
                </button>
              </div>
            </Notice>
          )}
        </>
      )}
      <div className="notice-actions">
        <button className="button secondary" onClick={onClose}>
          Cancel
        </button>
        {project && (
          <button className="button primary" onClick={() => onImport(project)}>
            Use this timetable
          </button>
        )}
      </div>
    </Modal>
  );
}
