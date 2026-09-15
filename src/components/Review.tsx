import { useMemo, useState } from "react";
import {
  CalendarCheck2,
  ChevronLeft,
  ChevronRight,
  Download,
  ListChecks,
  Share2,
  ShieldCheck,
} from "lucide-react";
import { type TimetableProject } from "../domain/model";
import { dateRange, formatDate, mondayOf, validDate } from "../domain/dates";
import { getRotationLabel, getTeachingWeeks } from "../domain/rotation";
import { generateOccurrences } from "../domain/occurrences";
import { buildCalendar, safeFilename } from "../domain/calendar";
import { validateProject } from "../domain/validation";
import { downloadFile, Field, Notice } from "./ui";

export function Review({
  project: p,
  notify,
}: {
  project: TimetableProject;
  notify: (message: string) => void;
}) {
  const [includeBreaks, setIncludeBreaks] = useState(false);
  const [selectedMonday, setSelectedMonday] = useState("");
  const [exported, setExported] = useState(false);
  const [exportError, setExportError] = useState("");
  const validation = useMemo(() => validateProject(p), [p]);
  const occurrences = useMemo(
    () => generateOccurrences(p, includeBreaks),
    [p, includeBreaks],
  );
  const weeks = useMemo(() => getTeachingWeeks(p), [p]);
  const index = Math.max(
    0,
    weeks.findIndex((w) => w.startDate === selectedMonday),
  );
  const week = weeks[index];
  const events = occurrences.filter((e) => week?.dates.includes(e.date));
  const lessons = occurrences.filter((e) => !e.structural);
  const first = lessons[0],
    last = lessons.at(-1);
  const valid = !validation.errors.length && !!lessons.length;
  const sampleFile = new File([""], "timetable.ics", { type: "text/calendar" });
  const canShare =
    typeof navigator.canShare === "function" &&
    navigator.canShare({ files: [sampleFile] });
  const exportCalendar = async (share: boolean) => {
    setExportError("");
    try {
      const content = buildCalendar(p, includeBreaks),
        name = `${safeFilename(p.name)}-timetable.ics`;
      if (share && canShare)
        await navigator.share({
          files: [new File([content], name, { type: "text/calendar" })],
          title: p.name,
        });
      else downloadFile(content, name, "text/calendar;charset=utf-8");
      setExported(true);
      notify(share ? "Calendar shared." : "Calendar file created.");
    } catch (error) {
      if (error instanceof Error && error.name !== "AbortError")
        setExportError(error.message);
    }
  };
  return (
    <div className="review-page">
      {validation.errors.length > 0 && (
        <Notice kind="error">
          <strong>A few things to finish before export</strong>
          <ul>
            {validation.errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </Notice>
      )}
      {validation.warnings.map((w) => (
        <Notice key={w}>{w}</Notice>
      ))}
      {!validation.errors.length && !lessons.length && (
        <Notice kind="error">
          No lessons fall on actual school days. Check the dates, holidays, and
          timetable weeks you've filled.
        </Notice>
      )}
      <section className="review-summary panel">
        <div className="review-summary-title">
          <span className="summary-icon">
            <CalendarCheck2 size={25} />
          </span>
          <div>
            <span className="eyebrow">Your calendar, at a glance</span>
            <h2>{p.name || "Your timetable"}</h2>
            <p>{dateRange(p.academicYear.startDate, p.academicYear.endDate)}</p>
          </div>
          <span className={`tag ${valid ? "green" : ""}`}>
            {valid ? (
              <>
                <ListChecks size={13} />
                Ready to export
              </>
            ) : (
              "Setup incomplete"
            )}
          </span>
        </div>
        <div className="review-stats">
          <div>
            <strong>{lessons.length.toLocaleString()}</strong>
            <span>individual lessons</span>
          </div>
          <div>
            <strong>
              {p.cycleLength}
              <small> week{p.cycleLength !== 1 ? "s" : ""}</small>
            </strong>
            <span>
              {Array.from({ length: p.cycleLength }, (_, i) =>
                getRotationLabel(i, p.rotationLabelStyle),
              ).join(" · ")}
            </span>
          </div>
          <div>
            <strong>{p.academicYear.exclusions.length}</strong>
            <span>holiday / day-off ranges</span>
          </div>
          <div>
            <strong>{weeks.length}</strong>
            <span>teaching weeks</span>
          </div>
        </div>
        <div className="first-last">
          <div>
            <span>FIRST LESSON</span>
            <strong>
              {first
                ? `${formatDate(first.date)} · ${first.startTime}`
                : "No lessons yet"}
            </strong>
            <small>{first?.title}</small>
          </div>
          <div>
            <span>LAST LESSON</span>
            <strong>
              {last
                ? `${formatDate(last.date)} · ${last.startTime}`
                : "No lessons yet"}
            </strong>
            <small>{last?.title}</small>
          </div>
        </div>
      </section>
      <div className="review-columns">
        <section className="panel calendar-preview">
          <div className="section-heading">
            <div>
              <h2>A look at your lessons</h2>
              <p className="muted small">
                Check any teaching week before you export.
              </p>
            </div>
          </div>
          {weeks.length > 0 && (
            <>
              <div className="preview-navigation">
                <button
                  className="icon-button"
                  aria-label="Previous teaching week"
                  disabled={index === 0}
                  onClick={() => setSelectedMonday(weeks[index - 1].startDate)}
                >
                  <ChevronLeft size={18} />
                </button>
                <select
                  aria-label="Preview teaching week"
                  value={week.startDate}
                  onChange={(e) => setSelectedMonday(e.target.value)}
                >
                  {weeks.map((w) => (
                    <option key={w.startDate} value={w.startDate}>
                      {formatDate(w.startDate)} ·{" "}
                      {getRotationLabel(w.rotationIndex, p.rotationLabelStyle)}
                    </option>
                  ))}
                </select>
                <button
                  className="icon-button"
                  aria-label="Next teaching week"
                  disabled={index >= weeks.length - 1}
                  onClick={() => setSelectedMonday(weeks[index + 1].startDate)}
                >
                  <ChevronRight size={18} />
                </button>
              </div>
              <Field label="Jump to a date">
                <input
                  type="date"
                  min={p.academicYear.startDate}
                  max={p.academicYear.endDate}
                  onChange={(e) => {
                    if (!validDate(e.target.value)) return;
                    const target = mondayOf(e.target.value),
                      match =
                        weeks.find((w) => w.startDate >= target) ??
                        weeks.at(-1);
                    if (match) {
                      setSelectedMonday(match.startDate);
                      if (match.startDate !== target)
                        notify(
                          "That week has no school days. Showing the next available teaching week.",
                        );
                    }
                  }}
                />
              </Field>
              <div className="preview-week-label">
                {getRotationLabel(week.rotationIndex, p.rotationLabelStyle)}{" "}
                <span>· {p.academicYear.timezone}</span>
              </div>
              {week.dates.map((date) => (
                <div className="preview-day" key={date} data-date={date}>
                  <h3>
                    {formatDate(date, {
                      weekday: "long",
                      day: "numeric",
                      month: "short",
                    })}
                  </h3>
                  {events
                    .filter((e) => e.date === date)
                    .map((event) => (
                      <div className="preview-event" key={event.uid}>
                        <time>
                          {event.startTime}
                          <small>{event.endTime}</small>
                        </time>
                        <span
                          className="event-stripe"
                          style={{ background: event.colour }}
                        />
                        <div>
                          <strong>{event.title}</strong>
                          <small>
                            {[event.room, event.teacher]
                              .filter(Boolean)
                              .join(" · ")}
                          </small>
                          {event.notes && <small>{event.notes}</small>}
                        </div>
                      </div>
                    ))}
                  {!events.some((e) => e.date === date) && (
                    <p className="muted small">No lessons scheduled.</p>
                  )}
                </div>
              ))}
            </>
          )}
          {!weeks.length && (
            <p className="muted">
              Your lesson preview appears once school dates are set.
            </p>
          )}
        </section>
        <aside className="export-column">
          <section className="export-card">
            <Download size={25} />
            <h2>
              Your year.
              <br />
              Ready to go.
            </h2>
            <p>
              Add your lessons to Apple Calendar, Google Calendar, Outlook, or
              another calendar app.
            </p>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={includeBreaks}
                onChange={(e) => {
                  setIncludeBreaks(e.target.checked);
                  setExported(false);
                }}
              />
              <span>
                Include registration, breaks and lunch
                <small>Off by default</small>
              </span>
            </label>
            <button
              className="button primary wide"
              disabled={!valid}
              onClick={() => void exportCalendar(false)}
            >
              <Download size={17} />
              Export Calendar (.ics)
            </button>
            {canShare && (
              <button
                className="button secondary wide"
                disabled={!valid}
                onClick={() => void exportCalendar(true)}
              >
                <Share2 size={17} />
                Share Calendar
              </button>
            )}
            <small className="export-file-note">
              {occurrences.length.toLocaleString()} events · .ics calendar file
            </small>
            {exportError && <Notice kind="error">{exportError}</Notice>}
          </section>
          {exported && (
            <Notice kind="success">
              Your calendar contains individual lessons for the selected school
              year. Holidays and days off have already been removed.
            </Notice>
          )}
          <div className="import-tips">
            <h3>Adding it to your calendar</h3>
            <p>
              <strong>Apple Calendar & Outlook</strong>
              <br />
              Open the downloaded .ics file and choose a calendar.
            </p>
            <p>
              <strong>Google Calendar</strong>
              <br />
              On a computer, open Settings → Import & export, then choose the
              file.
            </p>
            <p className="small">
              Tip: import into a separate school calendar. When replacing a
              previous export, remove that calendar's old events first to avoid
              duplicates.
            </p>
          </div>
          <div className="privacy-line">
            <ShieldCheck size={17} />
            <span>Created entirely on your device.</span>
          </div>
        </aside>
      </div>
    </div>
  );
}
