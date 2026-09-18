import { useState } from "react";
import { ChevronLeft, ChevronRight, ArrowRight } from "lucide-react";
import type { TimetableProject } from "../domain/model";
import { formatDate, mondayOf, validDate } from "../domain/dates";
import { getRotationLabel } from "../domain/rotation";
import { getYearProgress } from "../domain/progress";
import { useCalendar } from "../hooks/useCalendar";
import { useNow } from "../hooks/useNow";
import { CalendarOptions } from "./CalendarOptions";
import { YearProgress } from "./YearProgress";
import { Field, Notice } from "./ui";

export function LessonPreview({
  project: p,
  includeFixedPeriods,
  onIncludeFixedPeriodsChange,
  notify,
  navigate,
}: {
  project: TimetableProject;
  includeFixedPeriods: boolean;
  onIncludeFixedPeriodsChange: (value: boolean) => void;
  notify: (message: string) => void;
  navigate: (page: string) => void;
}) {
  const [selectedMonday, setSelectedMonday] = useState("");
  const now = useNow();
  const { validation, occurrences, lessons, weeks } = useCalendar(
    p,
    includeFixedPeriods,
  );
  const progress = getYearProgress(p, lessons, weeks, now);
  // Weeks are chronological: the completed count locates the next unfinished week.
  const defaultIndex = Math.max(
    0,
    Math.min(progress?.weeks.completed ?? 0, weeks.length - 1),
  );
  const selectedIndex = weeks.findIndex((w) => w.startDate === selectedMonday);
  const index = selectedIndex >= 0 ? selectedIndex : defaultIndex;
  const week = weeks[index];
  const events = occurrences.filter((e) => week?.dates.includes(e.date));
  return (
    <div className="lesson-preview-page page-stack">
      {!validation.errors.length && progress && (
        <YearProgress progress={progress} timezone={p.academicYear.timezone} />
      )}
      {validation.errors.length > 0 && (
        <Notice>
          Finish setting up your timetable to see your lessons on actual dates.{" "}
          <button className="inline-link" onClick={() => navigate("export")}>
            Check setup issues
          </button>
        </Notice>
      )}
      <section className="panel calendar-preview">
        <div className="section-heading">
          <div>
            <h2>A look at your lessons</h2>
            <p className="muted small">
              Browse your lessons by week or jump to a date.
            </p>
          </div>
        </div>
        <CalendarOptions
          value={includeFixedPeriods}
          onChange={onIncludeFixedPeriodsChange}
        />
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

      <div className="page-actions">
        <button className="button primary" onClick={() => navigate("export")}>
          Export &amp; share <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}
