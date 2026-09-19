import { useState } from "react";
import { Check, Copy, Pencil, Plus, Trash2 } from "lucide-react";
import type { TimetableProject } from "../domain/model";
import { Field, Modal, Notice } from "./ui";

export function TimetableSwitcher({
  timetables,
  activeId,
  error,
  onSelect,
  onCreate,
  onRename,
  onDuplicate,
  onDelete,
  onClose,
}: {
  timetables: TimetableProject[];
  activeId: string;
  error: string;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onRename: (id: string, name: string) => boolean;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  const [renaming, setRenaming] = useState<string | null>(
    () =>
      timetables.find((p) => p.id === activeId && !p.name.trim())?.id ?? null,
  );
  const [name, setName] = useState("");
  return (
    <Modal
      title="Your timetables"
      onClose={onClose}
      className="timetables-modal"
    >
      <p className="muted">
        Choose a timetable to continue. Each is saved separately on this device.
      </p>
      {error && <Notice kind="error">{error}</Notice>}
      <ul className="timetable-list">
        {timetables.map((p) => (
          <li key={p.id} className={p.id === activeId ? "active" : ""}>
            {renaming === p.id ? (
              <form
                className="timetable-rename"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (name.trim() && onRename(p.id, name)) setRenaming(null);
                }}
              >
                <Field label="Timetable name">
                  <input
                    autoFocus
                    required
                    maxLength={500}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </Field>
                <div className="page-actions">
                  <button className="button primary" disabled={!name.trim()}>
                    Save name
                  </button>
                  <button
                    type="button"
                    className="button secondary"
                    onClick={() => setRenaming(null)}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <>
                <button
                  className="timetable-choice"
                  onClick={() => onSelect(p.id)}
                  aria-current={p.id === activeId ? "true" : undefined}
                >
                  <span>
                    <strong>{p.name || "Untitled timetable"}</strong>
                    <small>
                      {p.id === activeId ? "Active · " : ""}
                      {p.setupComplete ? "Ready to use" : "Setup in progress"}
                    </small>
                  </span>
                  {p.id === activeId && <Check size={18} aria-hidden="true" />}
                </button>
                <div className="timetable-actions">
                  <button
                    className="icon-button"
                    aria-label={`Rename ${p.name || "Untitled timetable"}`}
                    title="Rename"
                    onClick={() => {
                      setRenaming(p.id);
                      setName(p.name);
                    }}
                  >
                    <Pencil size={17} />
                  </button>
                  <button
                    className="icon-button"
                    aria-label={`Duplicate ${p.name || "Untitled timetable"}`}
                    title="Duplicate"
                    onClick={() => onDuplicate(p.id)}
                  >
                    <Copy size={17} />
                  </button>
                  <button
                    className="icon-button danger"
                    aria-label={`Delete ${p.name || "Untitled timetable"}`}
                    title="Delete"
                    onClick={() => {
                      if (
                        window.confirm(
                          `Delete “${p.name || "Untitled timetable"}”? This cannot be undone. ${timetables.length === 1 ? "A new, empty timetable will open." : "Your other timetables will be kept."}`,
                        )
                      )
                        onDelete(p.id);
                    }}
                  >
                    <Trash2 size={17} />
                  </button>
                </div>
              </>
            )}
          </li>
        ))}
      </ul>
      <button className="button primary" onClick={onCreate}>
        <Plus size={17} />
        New timetable
      </button>
    </Modal>
  );
}
