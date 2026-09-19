import { useEffect, useRef, useState } from "react";
import { Download, FileSpreadsheet, Upload } from "lucide-react";
import { DAY_NAMES, schoolDays, type TimetableProject } from "../domain/model";
import { safeFilename } from "../domain/calendar";
import {
  MAX_SPREADSHEET_BYTES,
  SPREADSHEET_MIME,
  type SpreadsheetIssue,
  type SpreadsheetPreview,
  type SpreadsheetTask,
} from "../domain/spreadsheetTypes";
import { runSpreadsheetTask } from "../lib/spreadsheetWorker";
import { Modal, Notice } from "./ui";

export function SpreadsheetTools({
  project,
  onImport,
  saveError,
  notify,
}: {
  project: TimetableProject;
  onImport: (project: TimetableProject) => void;
  saveError: string;
  notify: (message: string) => void;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const pending = useRef<AbortController | null>(null);
  const [busy, setBusy] = useState(false);
  const [issues, setIssues] = useState<SpreadsheetIssue[]>([]);
  const [preview, setPreview] = useState<SpreadsheetPreview | null>(null);
  const [filename, setFilename] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [week, setWeek] = useState(0);
  useEffect(() => () => pending.current?.abort(), []);
  const cancel = () => {
    pending.current?.abort();
    pending.current = null;
    setBusy(false);
    setImportOpen(false);
    setPreview(null);
    setIssues([]);
  };
  const run = async (task: SpreadsheetTask, name?: string) => {
    pending.current?.abort();
    const controller = new AbortController();
    pending.current = controller;
    setBusy(true);
    setIssues([]);
    try {
      const result = await runSpreadsheetTask(task, controller.signal);
      if (controller.signal.aborted) return;
      if (result.type === "error") setIssues(result.issues);
      else if (result.type === "preview") {
        setPreview(result.preview);
        setWeek(result.preview.project.initialRotationIndex);
      } else {
        const url = URL.createObjectURL(
          new Blob([result.bytes], { type: SPREADSHEET_MIME }),
        );
        const link = document.createElement("a");
        link.href = url;
        link.download = name!;
        document.body.append(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        notify(
          task.type === "template"
            ? "Spreadsheet template downloaded."
            : "Active timetable exported to a spreadsheet.",
        );
      }
    } catch (error) {
      if (!controller.signal.aborted)
        setIssues([
          {
            location: "Workbook",
            message:
              error instanceof Error
                ? error.message
                : "The spreadsheet could not be processed.",
          },
        ]);
    } finally {
      if (pending.current === controller && !controller.signal.aborted)
        setBusy(false);
    }
  };
  const openFile = async (file?: File) => {
    if (!file) return;
    pending.current?.abort();
    pending.current = null;
    setBusy(false);
    setFilename(file.name);
    setImportOpen(true);
    setPreview(null);
    setIssues([]);
    if (!/\.xlsx$/i.test(file.name) || file.size > MAX_SPREADSHEET_BYTES) {
      setIssues([
        {
          location: "File",
          message: !/\.xlsx$/i.test(file.name)
            ? "Choose an .xlsx file. In Google Sheets, use File → Download → Microsoft Excel (.xlsx)."
            : "Choose a spreadsheet smaller than 2 MB.",
        },
      ]);
      return;
    }
    // Start cancellation before reading, so closing or switching cannot revive an old import.
    const reading = new AbortController();
    pending.current = reading;
    setBusy(true);
    try {
      const bytes = await file.arrayBuffer();
      if (reading.signal.aborted) return;
      await run({ type: "import", bytes });
    } catch {
      if (!reading.signal.aborted) {
        setBusy(false);
        setIssues([
          {
            location: "File",
            message: "This file could not be read. Choose it again.",
          },
        ]);
      }
    }
  };
  const errors = issues.length > 0 && (
    <Notice kind="error">
      <p>Fix these cells in the spreadsheet, then import it again.</p>
      <ul
        className="spreadsheet-issues"
        tabIndex={0}
        aria-label="Spreadsheet errors"
      >
        {issues.map((issue, i) => (
          <li key={i}>
            <strong>{issue.location}:</strong> {issue.message}
          </li>
        ))}
      </ul>
      {issues.length === 100 && <p>Showing the first 100 issues.</p>}
    </Notice>
  );
  const p = preview?.project;
  return (
    <section className="panel spreadsheet-card">
      <div className="section-heading">
        <div>
          <h2>Edit in a spreadsheet</h2>
          <p className="muted">
            Use Excel or Google Sheets to fill in your timetable, then bring it
            back to SchoolCal.
          </p>
        </div>
        <FileSpreadsheet size={20} className="muted" />
      </div>
      <div className="page-actions">
        <button
          className="button secondary"
          disabled={busy}
          onClick={() =>
            void run({ type: "template" }, "SchoolCal-template.xlsx")
          }
        >
          <Download size={16} />
          Download template (.xlsx)
        </button>
        <button
          className="button secondary"
          disabled={busy}
          onClick={() =>
            void run(
              { type: "export", project },
              `${safeFilename(project.name)}-timetable.xlsx`,
            )
          }
        >
          <Download size={16} />
          Export spreadsheet (.xlsx)
        </button>
        <button
          className="button secondary"
          disabled={busy}
          onClick={() => fileInput.current?.click()}
        >
          <Upload size={16} />
          Import spreadsheet (.xlsx)
        </button>
      </div>
      <input
        ref={fileInput}
        className="sr-only"
        tabIndex={-1}
        type="file"
        accept={`.xlsx,${SPREADSHEET_MIME}`}
        aria-label="Import spreadsheet file"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          void openFile(file);
        }}
      />
      <p className="muted small">
        Start with the template or export the active timetable. Imports show a
        preview and add a separate timetable, keeping your saved work.
      </p>
      {busy && !importOpen && <p role="status">Preparing your spreadsheet…</p>}
      {!importOpen && errors}
      <details className="import-tips">
        <summary>Using Excel or Google Sheets</summary>
        <div className="spreadsheet-help">
          <p>
            Edit Settings, Periods and Subjects first, then put subject codes
            into the Week 1–4 grids. The workbook includes instructions,
            holidays and optional lesson details.
          </p>
          <p>
            In Google Sheets, open the workbook and choose{" "}
            <strong>File → Download → Microsoft Excel (.xlsx)</strong> before
            importing it here. Keep the sheet names and headings; use values
            rather than formulas.
          </p>
          <p>
            Files stay on this device while SchoolCal reads or creates them. The
            template format is required; arbitrary spreadsheets, CSV files and
            photos are not supported.
          </p>
        </div>
      </details>
      {importOpen && (
        <Modal
          title="Preview spreadsheet import"
          onClose={cancel}
          className="spreadsheet-modal"
        >
          <p className="muted spreadsheet-filename">{filename}</p>
          {busy && <p role="status">Reading your spreadsheet…</p>}
          {errors}
          {saveError && <Notice kind="error">{saveError}</Notice>}
          {p && (
            <>
              <h3>{p.name}</h3>
              <p>
                {p.cycleLength}-week cycle · {p.subjects.length} subject
                {p.subjects.length === 1 ? "" : "s"} · {p.periods.length} period
                {p.periods.length === 1 ? "" : "s"} · {p.entries.length} lesson
                slot{p.entries.length === 1 ? "" : "s"}
              </p>
              <dl className="spreadsheet-summary">
                <div>
                  <dt>School year</dt>
                  <dd>
                    {p.academicYear.startDate || "Not set"} to{" "}
                    {p.academicYear.endDate || "Not set"}
                  </dd>
                </div>
                <div>
                  <dt>School days</dt>
                  <dd>
                    {schoolDays(p)
                      .map((day) => DAY_NAMES[day])
                      .join(", ")}
                  </dd>
                </div>
                <div>
                  <dt>Time zone</dt>
                  <dd>{p.academicYear.timezone}</dd>
                </div>
                <div>
                  <dt>Holidays</dt>
                  <dd>{p.academicYear.exclusions.length}</dd>
                </div>
                <div>
                  <dt>Status</dt>
                  <dd>
                    {p.setupComplete ? "Ready to use" : "Setup in progress"}
                  </dd>
                </div>
              </dl>
              {preview.warnings.length > 0 && (
                <Notice>
                  <ul>
                    {preview.warnings.map((message) => (
                      <li key={message}>{message}</li>
                    ))}
                  </ul>
                </Notice>
              )}
              <label className="spreadsheet-week">
                Preview week
                <select
                  value={week}
                  onChange={(event) => setWeek(Number(event.target.value))}
                >
                  {Array.from({ length: 4 }, (_, i) => (
                    <option key={i} value={i}>
                      Week{" "}
                      {p.rotationLabelStyle === "letters"
                        ? String.fromCharCode(65 + i)
                        : i + 1}
                      {i >= p.cycleLength ? " (hidden)" : ""}
                    </option>
                  ))}
                </select>
              </label>
              <div
                className="spreadsheet-preview"
                tabIndex={0}
                role="region"
                aria-label="Imported lessons"
              >
                <table>
                  <caption>Imported lesson slots — week {week + 1}</caption>
                  <thead>
                    <tr>
                      <th>Day</th>
                      <th>Time</th>
                      <th>Lesson</th>
                      <th>Teacher / room</th>
                    </tr>
                  </thead>
                  <tbody>
                    {p.entries
                      .filter((e) => e.rotationIndex === week)
                      .sort(
                        (a, b) =>
                          WEEKDAYS_ORDER(a.weekday) -
                            WEEKDAYS_ORDER(b.weekday) ||
                          p.periods.findIndex(
                            (period) => period.id === a.periodId,
                          ) -
                            p.periods.findIndex(
                              (period) => period.id === b.periodId,
                            ),
                      )
                      .map((entry) => {
                        const period = p.periods.find(
                            (period) => period.id === entry.periodId,
                          )!,
                          subject = p.subjects.find(
                            (subject) => subject.id === entry.subjectId,
                          )!;
                        return (
                          <tr key={entry.id}>
                            <td>{DAY_NAMES[entry.weekday]}</td>
                            <td>
                              {period.startTime}–{period.endTime}
                            </td>
                            <td>
                              {entry.titleOverride ?? subject.name}
                              {entry.notes && <small>{entry.notes}</small>}
                            </td>
                            <td>
                              {[
                                entry.teacherOverride ?? subject.teacher,
                                entry.roomOverride ?? subject.room,
                              ]
                                .filter(Boolean)
                                .join(" · ") || "—"}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
                {!p.entries.some((entry) => entry.rotationIndex === week) && (
                  <p>No lessons in this week.</p>
                )}
              </div>
              <p>
                Your saved timetables will be kept. This spreadsheet will be
                added as a new timetable.
              </p>
            </>
          )}
          <div className="notice-actions">
            <button className="button secondary" onClick={cancel}>
              Cancel
            </button>
            {issues.length > 0 && (
              <button
                className="button secondary"
                onClick={() => fileInput.current?.click()}
              >
                Choose another spreadsheet
              </button>
            )}
            {p && (
              <button className="button primary" onClick={() => onImport(p)}>
                Add timetable
              </button>
            )}
          </div>
        </Modal>
      )}
    </section>
  );
}

const WEEKDAYS_ORDER = (day: number) => (day + 6) % 7;
