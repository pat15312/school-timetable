import { ArrowRight, CalendarCheck2, ListChecks } from "lucide-react";
import type { TimetableProject } from "../domain/model";
import { dateRange, formatDate } from "../domain/dates";
import { getRotationLabel } from "../domain/rotation";
import { useCalendar } from "../hooks/useCalendar";
import { CalendarStatus } from "./CalendarStatus";

export function CalendarOverview({
  project: p,
  navigate,
}: {
  project: TimetableProject;
  navigate: (page: string) => void;
}) {
  const { validation, lessons, weeks, valid } = useCalendar(p);
  const first = lessons[0],
    last = lessons.at(-1);
  return (
    <div className="calendar-overview page-stack">
      <CalendarStatus
        project={p}
        validation={validation}
        hasLessons={!!lessons.length}
        navigate={navigate}
      />
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

      <div className="page-actions">
        <button
          className="button secondary"
          onClick={() => navigate("preview")}
        >
          Preview lessons <ArrowRight size={16} />
        </button>
        <button className="button primary" onClick={() => navigate("export")}>
          Export &amp; share <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}
