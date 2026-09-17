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
  const [includeFixedPeriods, setIncludeFixedPeriods] = useState(false);
  const [selectedMonday, setSelectedMonday] = useState("");
  const [exported, setExported] = useState(false);
  const [exportError, setExportError] = useState("");
  const [sharing, setSharing] = useState(false);
  const [shareUnavailable, setShareUnavailable] = useState(false);
  const validation = useMemo(() => validateProject(p), [p]);
  const occurrences = useMemo(
    () => generateOccurrences(p, includeFixedPeriods),
    [p, includeFixedPeriods],
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
  // Prepare the actual file before the click so sharing keeps its user activation.
  const calendar = useMemo(() => {
    if (!valid) return null;
    try {
      const content = buildCalendar(p, includeFixedPeriods);
      return {
        content,
        file: new File([content], `${safeFilename(p.name)}-timetable.ics`, {
          type: "text/calendar",
        }),
        error: "",
      };
    } catch (error) {
      return {
        content: "",
        file: null,
        error:
          error instanceof Error
            ? error.message
            : "The calendar could not be created. Please try again.",
      };
    }
  }, [p, includeFixedPeriods, valid]);
  const canShare = useMemo(() => {
    try {
      return (
        !!calendar?.file &&
        typeof navigator.share === "function" &&
        typeof navigator.canShare === "function" &&
        navigator.canShare({ files: [calendar.file] })
      );
    } catch {
      return false;
    }
  }, [calendar]);
  const exportCalendar = async (share: boolean) => {
    if (!calendar?.file || sharing) return;
    setExportError("");
    setExported(false);
    if (share && canShare && !shareUnavailable) {
      setSharing(true);
      try {
        await navigator.share({ files: [calendar.file], title: p.name });
        setExported(true);
        notify("Calendar file passed to your device’s sharing menu.");
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;
        setShareUnavailable(true);
        notify(
          "Sharing is unavailable. Choose Download to share to save the calendar file.",
        );
      } finally {
        setSharing(false);
      }
      return;
    }
    try {
      downloadFile(
        calendar.content,
        calendar.file.name,
        "text/calendar;charset=utf-8",
      );
      setExported(true);
      notify("Calendar file downloaded.");
    } catch {
      setExportError(
        "The calendar file could not be downloaded. Please try again.",
      );
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
      <div className="review-sections">
        <section className="panel export-card">
          <div className="section-heading">
            <div>
              <h2>Export your calendar</h2>
              <p className="muted">
                Add your lessons to Apple Calendar, Google Calendar, Outlook, or
                another calendar app.
              </p>
            </div>
            <Download size={20} className="muted" />
          </div>
          <div className="export-options">
            <div>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={includeFixedPeriods}
                  onChange={(e) => {
                    setIncludeFixedPeriods(e.target.checked);
                    setExported(false);
                  }}
                />
                <span>
                  Include fixed periods
                  <small>
                    Categories with Allow subjects off. Off by default.
                  </small>
                </span>
              </label>
            </div>
            <div className="export-actions">
              <button
                className="button primary wide"
                disabled={!calendar?.file || sharing}
                onClick={() => void exportCalendar(false)}
              >
                <Download size={17} />
                Export Calendar (.ics)
              </button>
              {(canShare || shareUnavailable) && (
                <>
                  <button
                    className="button secondary wide"
                    disabled={!calendar?.file || sharing}
                    aria-describedby="calendar-share-help"
                    onClick={() => void exportCalendar(!shareUnavailable)}
                  >
                    {shareUnavailable ? (
                      <Download size={17} />
                    ) : (
                      <Share2 size={17} />
                    )}
                    {shareUnavailable
                      ? "Download to share"
                      : sharing
                        ? "Opening sharing…"
                        : "Share calendar file"}
                  </button>
                  <small
                    id="calendar-share-help"
                    className="export-file-note export-share-help"
                  >
                    {shareUnavailable
                      ? "Your browser couldn’t open sharing. Download the .ics file, then attach it in your preferred app."
                      : "Opens your device’s sharing menu to send the .ics file through another app."}
                  </small>
                </>
              )}
              <small className="export-file-note">
                {occurrences.length.toLocaleString()} events · .ics calendar
                file
              </small>
              {(calendar?.error || exportError) && (
                <Notice kind="error">{calendar?.error || exportError}</Notice>
              )}
            </div>
          </div>
        </section>
        {exported && (
          <Notice kind="success">
            Your calendar contains individual lessons for the selected school
            year. Holidays and days off have already been removed.
          </Notice>
        )}
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
              <div className="preview-filters form-grid">
                <div className="field">
                  <span id="teaching-week-label">Teaching week</span>
                  <div
                    className="preview-navigation"
                    role="group"
                    aria-labelledby="teaching-week-label"
                  >
                    <select
                      aria-label="Preview teaching week"
                      value={week.startDate}
                      onChange={(e) => setSelectedMonday(e.target.value)}
                    >
                      {weeks.map((w) => (
                        <option key={w.startDate} value={w.startDate}>
                          {formatDate(w.startDate)} ·{" "}
                          {getRotationLabel(
                            w.rotationIndex,
                            p.rotationLabelStyle,
                          )}
                        </option>
                      ))}
                    </select>
                    <div className="preview-week-buttons">
                      <button
                        className="icon-button"
                        aria-label="Previous teaching week"
                        disabled={index === 0}
                        onClick={() =>
                          setSelectedMonday(weeks[index - 1].startDate)
                        }
                      >
                        <ChevronLeft size={18} />
                        <span className="preview-direction">Previous</span>
                      </button>
                      <button
                        className="icon-button"
                        aria-label="Next teaching week"
                        disabled={index >= weeks.length - 1}
                        onClick={() =>
                          setSelectedMonday(weeks[index + 1].startDate)
                        }
                      >
                        <span className="preview-direction">Next</span>
                        <ChevronRight size={18} />
                      </button>
                    </div>
                  </div>
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
              </div>
              <div className="preview-week-label">
                {getRotationLabel(week.rotationIndex, p.rotationLabelStyle)}{" "}
                <span>· {p.academicYear.timezone}</span>
              </div>
              <div className="preview-days">
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
              </div>
            </>
          )}
          {!weeks.length && (
            <p className="muted">
              Your lesson preview appears once school dates are set.
            </p>
          )}
        </section>
        <section className="panel import-tips">
          <div className="section-heading">
            <h2>Adding it to your calendar</h2>
          </div>
          <div className="import-tip-grid">
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
        </section>
      </div>
    </div>
  );
}
