import { useEffect, useState } from "react";
import type { TimetableProject } from "../domain/model";
import type { Occurrence } from "../domain/occurrences";
import type { TeachingWeek } from "../domain/rotation";
import { getYearProgress } from "../domain/progress";

export function YearProgress({
  project,
  lessons,
  weeks,
}: {
  project: TimetableProject;
  lessons: Occurrence[];
  weeks: TeachingWeek[];
}) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const refresh = () => setNow(new Date());
    const timer = window.setInterval(refresh, 30_000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);
  const progress = getYearProgress(project, lessons, weeks, now);
  if (!progress) return null;
  return (
    <section
      className="panel year-progress"
      aria-labelledby="year-progress-title"
    >
      <h2 id="year-progress-title">Your year so far</h2>
      <div className="year-progress-stats">
        {[
          { label: "Lessons", noun: "lessons this year", ...progress.lessons },
          {
            label: "Teaching weeks",
            noun: "teaching weeks",
            ...progress.weeks,
          },
        ].map(({ label, noun, completed, total, percentage }) => (
          <div className="year-progress-stat" key={label}>
            <div className="year-progress-total">
              <span>
                <strong>{total.toLocaleString()}</strong> {noun}
              </span>
              <b>{percentage.toLocaleString()}% done!</b>
            </div>
            <progress
              aria-label={`${label} completed`}
              aria-valuetext={`${completed.toLocaleString()} of ${total.toLocaleString()} ${noun} completed`}
              value={completed}
              max={total || 1}
            />
            <p className="muted small">
              {completed.toLocaleString()} completed ·{" "}
              {(total - completed).toLocaleString()} to go
            </p>
          </div>
        ))}
      </div>
      <p className="muted small">
        Based on scheduled lesson and school-day end times in{" "}
        {project.academicYear.timezone}.
      </p>
    </section>
  );
}
