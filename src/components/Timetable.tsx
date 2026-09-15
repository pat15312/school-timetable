import { useEffect, useState, type CSSProperties } from "react";
import {
  ArrowRight,
  Check,
  ClipboardPaste,
  Copy,
  Eraser,
  MousePointer2,
  Paintbrush,
  Pencil,
  Plus,
  Undo2,
  X,
} from "lucide-react";
import {
  DAY_NAMES,
  cellKey,
  isStructural,
  sameCell,
  schoolDays,
  sortedPeriods,
  type Cell,
  type Subject,
  type TimetableEntry,
} from "../domain/model";
import { duplicateWeek, putEntry } from "../domain/editing";
import { resolveEntry } from "../domain/occurrences";
import { getRotationLabel } from "../domain/rotation";
import { SubjectForm, type SettingsProps } from "./Setup";
import { EmptyState, Field, Modal, Notice } from "./ui";

interface Props extends SettingsProps {
  editEntries: (
    change: (entries: TimetableEntry[]) => TimetableEntry[],
  ) => void;
  undo: () => void;
  canUndo: boolean;
  notify: (message: string) => void;
  navigate: (page: string) => void;
}
export function Timetable({
  project: p,
  update,
  editEntries,
  undo,
  canUndo,
  notify,
  navigate,
}: Props) {
  const [week, setWeek] = useState(0);
  const [day, setDay] = useState(schoolDays(p)[0] ?? 1);
  const [tool, setTool] = useState<"select" | "erase" | string>("select");
  const [selected, setSelected] = useState<Cell | null>(null);
  const [clipboard, setClipboard] = useState<TimetableEntry | null>(null);
  const [editLesson, setEditLesson] = useState(false);
  const [addSubject, setAddSubject] = useState(false);
  const [duplicate, setDuplicate] = useState(false);
  const [destination, setDestination] = useState(week === 0 ? 1 : 0);
  const days = schoolDays(p),
    periods = sortedPeriods(p);
  const currentWeek = Math.min(week, p.cycleLength - 1);
  const currentDay = days.includes(day) ? day : days[0];
  const currentEntry = selected && p.entries.find((e) => sameCell(e, selected));
  const currentSubject =
    currentEntry && p.subjects.find((s) => s.id === currentEntry.subjectId);
  const activeSubject = p.subjects.find((s) => s.id === tool);
  const pickerDetails = (subject: Subject) => {
    const name = (subject.shortName || subject.name).trim().toLowerCase();
    const hasSameName = p.subjects.some(
      (s) =>
        s.id !== subject.id &&
        (s.shortName || s.name).trim().toLowerCase() === name,
    );
    return hasSameName
      ? [subject.teacher, subject.room].filter(Boolean).join(" · ") ||
          "No default teacher or room"
      : "";
  };
  const count = p.entries.filter(
    (e) =>
      e.rotationIndex === currentWeek &&
      days.includes(e.weekday) &&
      periods.some(
        (period) => period.id === e.periodId && !isStructural(period, p),
      ),
  ).length;
  const label = (i: number) => getRotationLabel(i, p.rotationLabelStyle);
  const clear = () => {
    if (selected && currentEntry) {
      editEntries((entries) => putEntry(entries, selected, null));
      notify("Lesson cleared.");
    }
  };
  const copy = () => {
    if (currentEntry) {
      setClipboard({ ...currentEntry });
      notify("Lesson copied. Select a cell, then paste.");
    }
  };
  const paste = () => {
    if (selected && clipboard) {
      editEntries((entries) => putEntry(entries, selected, clipboard));
      notify("Lesson pasted.");
    }
  };
  useEffect(() => {
    const keydown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.closest(
          'input, textarea, select, [contenteditable="true"], dialog',
        )
      )
        return;
      const command = e.ctrlKey || e.metaKey;
      if (e.key === "Escape") {
        setTool("select");
        setSelected(null);
      }
      if (command && e.key.toLowerCase() === "z" && canUndo) {
        e.preventDefault();
        undo();
        notify("Last edit undone.");
      }
      if (command && e.key.toLowerCase() === "c" && currentEntry) {
        e.preventDefault();
        copy();
      }
      if (command && e.key.toLowerCase() === "v" && selected && clipboard) {
        e.preventDefault();
        paste();
      }
      if (
        (e.key === "Delete" || e.key === "Backspace") &&
        selected &&
        currentEntry
      ) {
        e.preventDefault();
        clear();
      }
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  });
  const activate = (cell: Cell) => {
    setSelected(cell);
    if (tool === "erase") {
      if (p.entries.some((e) => sameCell(e, cell)))
        editEntries((entries) => putEntry(entries, cell, null));
    } else if (activeSubject)
      editEntries((entries) =>
        putEntry(entries, cell, { ...cell, subjectId: activeSubject.id }),
      );
  };
  const cellButton = (cell: Cell) => {
    const entry = p.entries.find((e) => sameCell(e, cell)),
      subject = entry && p.subjects.find((s) => s.id === entry.subjectId);
    const details = entry && subject && resolveEntry(entry, subject);
    const period = periods.find((period) => period.id === cell.periodId)!;
    const isSelected = selected && sameCell(selected, cell);
    return (
      <button
        type="button"
        className={`lesson-cell ${details ? "filled" : "empty"} ${isSelected ? "is-selected" : ""}`}
        data-cell={cellKey(cell)}
        aria-label={`${DAY_NAMES[cell.weekday]} ${period.name}${details ? `, ${details.title}` : ", empty"}`}
        aria-pressed={!!isSelected}
        style={
          details
            ? ({
                "--subject-colour": details.colour,
                "--subject-background": `${details.colour}20`,
              } as CSSProperties)
            : undefined
        }
        onClick={() => activate(cell)}
        onDoubleClick={() => {
          if (entry && tool === "select") {
            setSelected(cell);
            setEditLesson(true);
          }
        }}
        onKeyDown={(e) => {
          if (
            !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)
          )
            return;
          e.preventDefault();
          const editable = periods.filter((period) => !isStructural(period, p));
          const x = days.indexOf(cell.weekday),
            y = editable.findIndex((period) => period.id === cell.periodId);
          const nextX = Math.max(
            0,
            Math.min(
              days.length - 1,
              x + (e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0),
            ),
          );
          const nextY = Math.max(
            0,
            Math.min(
              editable.length - 1,
              y + (e.key === "ArrowDown" ? 1 : e.key === "ArrowUp" ? -1 : 0),
            ),
          );
          const next = {
            ...cell,
            weekday: days[nextX],
            periodId: editable[nextY].id,
          };
          const area =
            e.currentTarget.closest(".desktop-timetable, .mobile-timetable") ??
            document;
          area
            .querySelector<HTMLButtonElement>(`[data-cell="${cellKey(next)}"]`)
            ?.focus();
          setSelected(next);
        }}
      >
        {details ? (
          <>
            <strong>
              {entry?.titleOverride || subject?.shortName || details.title}
            </strong>
            {details.room && <span>{details.room}</span>}
            {details.teacher && <small>{details.teacher}</small>}
            {entry &&
              (entry.titleOverride !== undefined ||
                entry.roomOverride !== undefined ||
                entry.teacherOverride !== undefined ||
                entry.notes) && (
                <span
                  className="override-indicator"
                  title="This lesson has its own details"
                >
                  <Pencil size={10} />
                </span>
              )}
          </>
        ) : (
          <>
            <Plus size={17} />
            <span>Add lesson</span>
          </>
        )}
      </button>
    );
  };
  return (
    <div className="editor">
      <div className="editor-heading">
        <div className="week-tabs" role="tablist" aria-label="Timetable week">
          {Array.from({ length: p.cycleLength }, (_, i) => (
            <button
              role="tab"
              aria-selected={currentWeek === i}
              key={i}
              className={currentWeek === i ? "active" : ""}
              onClick={() => {
                setWeek(i);
                setSelected(null);
              }}
            >
              {label(i)}
            </button>
          ))}
        </div>
        <div className="editor-heading-right">
          <span className="muted small">{count} lessons this week</span>
          {p.cycleLength > 1 && (
            <button
              className="button text-button"
              onClick={() => {
                setDestination(currentWeek === 0 ? 1 : 0);
                setDuplicate(true);
              }}
            >
              <Copy size={15} />
              Copy week
            </button>
          )}
        </div>
      </div>
      <section className="subject-palette" aria-label="Subject palette">
        <div className="palette-heading">
          <div>
            <Paintbrush size={16} />
            <strong>Pick a subject, then tap to place</strong>
          </div>
          <button
            className="button text-button"
            onClick={() => setAddSubject(true)}
            disabled={p.subjects.length >= 100}
          >
            <Plus size={15} />
            Add subject
          </button>
        </div>
        <div className="palette-items">
          {p.subjects.map((subject) => (
            <button
              key={subject.id}
              className={`palette-subject ${tool === subject.id ? "active" : ""}`}
              style={
                {
                  "--subject-colour": subject.colour,
                  "--subject-background": `${subject.colour}20`,
                } as CSSProperties
              }
              aria-pressed={tool === subject.id}
              title={[subject.name, subject.teacher, subject.room]
                .filter(Boolean)
                .join(" · ")}
              onClick={() =>
                setTool(tool === subject.id ? "select" : subject.id)
              }
            >
              <i style={{ background: subject.colour }} />
              <span className="palette-subject-label">
                <span>{subject.shortName || subject.name}</span>
                {pickerDetails(subject) && (
                  <small>{pickerDetails(subject)}</small>
                )}
              </span>
              {tool === subject.id && <Check size={14} />}
            </button>
          ))}
          {!p.subjects.length && (
            <span className="muted small">
              Add a subject to start filling your week.
            </span>
          )}
          <span className="palette-divider" />
          <button
            className={`palette-tool ${tool === "select" ? "active" : ""}`}
            aria-pressed={tool === "select"}
            onClick={() => setTool("select")}
          >
            <MousePointer2 size={16} />
            Select
          </button>
          <button
            className={`palette-tool ${tool === "erase" ? "active" : ""}`}
            aria-pressed={tool === "erase"}
            onClick={() => setTool("erase")}
          >
            <Eraser size={16} />
            Erase
          </button>
        </div>
      </section>
      <div className="editor-toolbar">
        <span className="tool-status">
          {activeSubject ? (
            <>
              <span className="status-dot" />
              <span>
                Placing {activeSubject.name}
                {pickerDetails(activeSubject) &&
                  ` · ${pickerDetails(activeSubject)}`}
              </span>
              <button
                onClick={() => setTool("select")}
                aria-label="Stop placing subject"
              >
                <X size={14} />
              </button>
            </>
          ) : tool === "erase" ? (
            "Tap a lesson to erase it"
          ) : (
            "Select a lesson to copy or edit its details"
          )}
        </span>
        <div className="toolbar-buttons">
          <button
            onClick={undo}
            disabled={!canUndo}
            aria-label="Undo last edit"
            title="Undo (Ctrl/⌘ Z)"
          >
            <Undo2 size={16} />
            <span>Undo</span>
          </button>
          <button
            onClick={copy}
            disabled={!currentEntry}
            title="Copy (Ctrl/⌘ C)"
          >
            <Copy size={15} />
            <span>Copy</span>
          </button>
          <button
            onClick={paste}
            disabled={!selected || !clipboard}
            title="Paste (Ctrl/⌘ V)"
          >
            <ClipboardPaste size={16} />
            <span>Paste</span>
          </button>
          <button onClick={clear} disabled={!currentEntry}>
            <Eraser size={16} />
            <span>Clear</span>
          </button>
          <button onClick={() => setEditLesson(true)} disabled={!currentEntry}>
            <Pencil size={16} />
            <span>Edit lesson</span>
          </button>
        </div>
      </div>
      {!days.length || !periods.length ? (
        <EmptyState
          title="Your timetable needs a school day"
          action="Set lesson times"
          onAction={() => navigate("periods")}
        >
          Choose your school days and add lesson periods to begin.
        </EmptyState>
      ) : (
        <>
          <div className="desktop-timetable">
            <table className="timetable-table">
              <caption className="sr-only">
                {p.name} — {label(currentWeek)}
              </caption>
              <thead>
                <tr>
                  <th scope="col">Time</th>
                  {days.map((d) => (
                    <th scope="col" key={d}>
                      {DAY_NAMES[d]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {periods.map((period) => (
                  <tr
                    key={period.id}
                    className={isStructural(period, p) ? "structural-row" : ""}
                  >
                    <th scope="row">
                      <strong>{period.name}</strong>
                      <span>
                        {period.startTime || "—"} – {period.endTime || "—"}
                      </span>
                    </th>
                    {isStructural(period, p) ? (
                      <td colSpan={days.length}>
                        <div className="structural-label">
                          <span />
                          {period.name}
                          <span />
                        </div>
                      </td>
                    ) : (
                      days.map((d) => (
                        <td key={d}>
                          {cellButton({
                            rotationIndex: currentWeek,
                            weekday: d,
                            periodId: period.id,
                          })}
                        </td>
                      ))
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mobile-timetable">
            <div className="day-tabs" role="tablist" aria-label="School day">
              {days.map((d) => (
                <button
                  key={d}
                  role="tab"
                  aria-selected={currentDay === d}
                  className={currentDay === d ? "active" : ""}
                  onClick={() => {
                    setDay(d);
                    setSelected(null);
                  }}
                >
                  {DAY_NAMES[d].slice(0, 3)}
                </button>
              ))}
            </div>
            <h3>{DAY_NAMES[currentDay]}</h3>
            {periods.map((period) => (
              <div
                className={`mobile-period ${isStructural(period, p) ? "structural" : ""}`}
                key={period.id}
              >
                <div>
                  <strong>{period.startTime || "—"}</strong>
                  <span>{period.endTime || "—"}</span>
                </div>
                {isStructural(period, p) ? (
                  <div className="mobile-break">{period.name}</div>
                ) : (
                  <div className="mobile-cell-wrap">
                    <small>{period.name}</small>
                    {cellButton({
                      rotationIndex: currentWeek,
                      weekday: currentDay,
                      periodId: period.id,
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
      <div className="editor-footer">
        <p>
          <span className="legend-dot" />
          Your timetable is saved as you go.
        </p>
        <button
          className="button text-button"
          onClick={() => navigate("review")}
        >
          Review your calendar <ArrowRight size={16} />
        </button>
      </div>
      {addSubject && (
        <Modal title="Add a subject" onClose={() => setAddSubject(false)}>
          <SubjectForm
            onCancel={() => setAddSubject(false)}
            onSave={(subject) => {
              update((p) => ({ ...p, subjects: [...p.subjects, subject] }));
              setTool(subject.id);
              setAddSubject(false);
              notify(`${subject.name} added. Tap a cell to place it.`);
            }}
          />
        </Modal>
      )}
      {editLesson && currentEntry && currentSubject && (
        <Modal title="Lesson details" onClose={() => setEditLesson(false)}>
          <LessonForm
            entry={currentEntry}
            subject={currentSubject}
            onSave={(entry) => {
              editEntries((entries) =>
                entries.map((e) => (e.id === entry.id ? entry : e)),
              );
              setEditLesson(false);
              notify("Lesson details updated.");
            }}
            onCancel={() => setEditLesson(false)}
          />
        </Modal>
      )}
      {duplicate && (
        <Modal
          title={`Copy ${label(currentWeek)}`}
          onClose={() => setDuplicate(false)}
        >
          <p className="muted">
            Copy all lessons and their individual details to another week.
          </p>
          <Field label="Copy to">
            <select
              value={destination}
              onChange={(e) => setDestination(+e.target.value)}
            >
              {Array.from(
                { length: p.cycleLength },
                (_, i) =>
                  i !== currentWeek && (
                    <option key={i} value={i}>
                      {label(i)}
                    </option>
                  ),
              )}
            </select>
          </Field>
          {p.entries.some((e) => e.rotationIndex === destination) && (
            <Notice>
              The existing lessons in {label(destination)} will be replaced. You
              can undo this.
            </Notice>
          )}
          <div className="form-actions">
            <button
              className="button secondary"
              onClick={() => setDuplicate(false)}
            >
              Cancel
            </button>
            <button
              className="button primary"
              onClick={() => {
                editEntries((entries) =>
                  duplicateWeek(entries, currentWeek, destination),
                );
                setDuplicate(false);
                setWeek(destination);
                setSelected(null);
                notify(
                  `${label(currentWeek)} copied to ${label(destination)}.`,
                );
              }}
            >
              <Copy size={16} />
              {`Copy ${label(currentWeek)} to ${label(destination)}`}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function LessonForm({
  entry,
  subject,
  onSave,
  onCancel,
}: {
  entry: TimetableEntry;
  subject: Subject;
  onSave: (entry: TimetableEntry) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(entry);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave(draft);
      }}
    >
      <p className="muted">
        Changes here apply only to this timetable cell. Subject defaults stay
        linked until you override them.
      </p>
      {(
        [
          ["Lesson title", "titleOverride", subject.name],
          ["Teacher", "teacherOverride", subject.teacher || "No teacher"],
          ["Room / location", "roomOverride", subject.room || "No room"],
        ] as const
      ).map(([label, property, fallback]) => (
        <div className="override-field" key={property}>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={draft[property] !== undefined}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  [property]: e.target.checked
                    ? ((property === "titleOverride"
                        ? subject.name
                        : property === "teacherOverride"
                          ? subject.teacher
                          : subject.room) ?? "")
                    : undefined,
                })
              }
            />
            Override {label.toLowerCase()}
          </label>
          <Field label={label}>
            <input
              maxLength={500}
              required={
                property === "titleOverride" && draft[property] !== undefined
              }
              disabled={draft[property] === undefined}
              value={draft[property] ?? fallback}
              onChange={(e) =>
                setDraft({ ...draft, [property]: e.target.value })
              }
            />
          </Field>
        </div>
      ))}
      <Field label="Notes (optional)">
        <textarea
          maxLength={4000}
          rows={3}
          value={draft.notes ?? ""}
          placeholder="e.g. Bring your lab coat"
          onChange={(e) =>
            setDraft({ ...draft, notes: e.target.value || undefined })
          }
        />
      </Field>
      <div className="form-actions">
        <button type="button" className="button secondary" onClick={onCancel}>
          Cancel
        </button>
        <button className="button primary" type="submit">
          Save lesson
        </button>
      </div>
    </form>
  );
}
