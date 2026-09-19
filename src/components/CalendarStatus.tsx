import type { TimetableProject } from "../domain/model";
import type { Validation } from "../domain/validation";
import { Notice } from "./ui";

export function CalendarStatus({
  project,
  validation,
  hasLessons,
  navigate,
}: {
  project: TimetableProject;
  validation: Validation;
  hasLessons: boolean;
  navigate: (page: string) => void;
}) {
  function destination(message: string): [string, string] {
    if (
      /holiday|day off/i.test(message) ||
      project.academicYear.exclusions.some(
        (e) => e.name && message.startsWith(e.name),
      )
    )
      return ["holidays", "Check holidays"];
    if (/timetable a name/.test(message)) return ["timetables", "Name timetable"];
    if (/timetable week/.test(message)) return ["year", "Check rotation"];
    if (
      /school year|school day|school time zone/.test(message)
    )
      return ["year", "Check school year"];
    if (/period|category|categories|label|must end/.test(message))
      return ["periods", "Check lesson times"];
    if (/each subject/.test(message)) return ["subjects", "Check subjects"];
    return ["timetable", "Edit timetable"];
  }
  const issue = (message: string) => {
    const [page, label] = destination(message);
    return (
      <li key={message}>
        {message}{" "}
        <button className="inline-link" onClick={() => navigate(page)}>
          {label}
        </button>
      </li>
    );
  };
  return (
    <>
      {validation.errors.length > 0 && (
        <Notice kind="error">
          <strong>A few things to finish before calendar export</strong>
          <ul>{validation.errors.map(issue)}</ul>
        </Notice>
      )}
      {validation.warnings.length > 0 && (
        <Notice>
          <ul>{validation.warnings.map(issue)}</ul>
        </Notice>
      )}
      {!validation.errors.length && !hasLessons && (
        <Notice>
          No lessons fall on actual school days.{" "}
          <button className="inline-link" onClick={() => navigate("year")}>
            Check school dates
          </button>
          ,{" "}
          <button className="inline-link" onClick={() => navigate("holidays")}>
            holidays
          </button>
          , and{" "}
          <button className="inline-link" onClick={() => navigate("timetable")}>
            your timetable
          </button>
          .
        </Notice>
      )}
    </>
  );
}
