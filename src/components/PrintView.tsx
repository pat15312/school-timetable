import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { Printer } from "lucide-react";
import { BRAND } from "../brand";
import { DAY_NAMES, type TimetableProject } from "../domain/model";
import { dateRange } from "../domain/dates";
import { preparePrintPages, type PrintLayout } from "../domain/print";
import { Notice } from "./ui";

export function PrintView({ project: p }: { project: TimetableProject }) {
  const [layout, setLayout] = useState<PrintLayout>("landscape");
  const sheets = useRef<HTMLDivElement>(null);
  const pages = preparePrintPages(p, layout);
  useLayoutEffect(() => {
    const fit = () => {
      sheets.current
        ?.querySelectorAll<HTMLElement>(".print-table-wrap")
        .forEach((wrap) => {
          const table = wrap.querySelector<HTMLTableElement>("table")!;
          table.style.transform = "";
          table.style.width = "100%";
          table.style.height = "100%";
          const available = wrap.clientHeight;
          if (available <= 0 || table.scrollHeight <= available) return;
          // Scale an unusually long school day as a whole, preserving every row and label.
          const scale = Math.min(1, (available - 1) / table.scrollHeight);
          table.style.width = `${100 / scale}%`;
          table.style.height = "auto";
          table.style.transform = `scale(${scale})`;
        });
    };
    const media = window.matchMedia("print");
    const observer = new ResizeObserver(fit);
    if (sheets.current) observer.observe(sheets.current);
    window.addEventListener("beforeprint", fit);
    window.addEventListener("afterprint", fit);
    media.addEventListener("change", fit);
    fit();
    return () => {
      observer.disconnect();
      window.removeEventListener("beforeprint", fit);
      window.removeEventListener("afterprint", fit);
      media.removeEventListener("change", fit);
    };
  }, [p, layout]);
  return (
    <div className={`print-view ${layout}`}>
      <style media="print">{`@page { size: A4 ${layout}; margin: 10mm; }`}</style>
      <div className="print-controls">
        <div className="print-options">
          <label
            className={`radio-card ${layout === "landscape" ? "selected" : ""}`}
          >
            <input
              type="radio"
              name="print-layout"
              checked={layout === "landscape"}
              onChange={() => setLayout("landscape")}
            />
            <span>
              <strong>One week per page</strong>
              <small>A4 landscape</small>
            </span>
          </label>
          <label
            className={`radio-card ${layout === "portrait" ? "selected" : ""}`}
          >
            <input
              type="radio"
              name="print-layout"
              checked={layout === "portrait"}
              onChange={() => setLayout("portrait")}
            />
            <span>
              <strong>Two weeks per page</strong>
              <small>A4 portrait</small>
            </span>
          </label>
        </div>
        <button
          className="button primary"
          disabled={!p.periods.length || !p.academicYear.schoolWeekdays.length}
          onClick={() => window.print()}
        >
          <Printer size={17} />
          Print / Save as PDF
        </button>
      </div>
      <div className="print-help">
        <Notice>
          Use A4 paper and turn off the browser's headers and footers for a
          clean print. Your preview below includes all {p.cycleLength} timetable
          week{p.cycleLength !== 1 ? "s" : ""}.
        </Notice>
      </div>
      <div className="print-sheets" ref={sheets}>
        {pages.map((weeks, pageIndex) => (
          <article
            className="print-sheet"
            key={pageIndex}
            aria-label={`Print page ${pageIndex + 1}`}
            style={
              { "--row-count": Math.max(1, p.periods.length) } as CSSProperties
            }
          >
            <header className="print-header">
              <div>
                <span className="print-brand">{BRAND.name}</span>
                <h2>{p.name || "My school timetable"}</h2>
                <p>
                  {dateRange(p.academicYear.startDate, p.academicYear.endDate)}
                </p>
              </div>
              <span>MY SCHOOL WEEK</span>
            </header>
            <div className="print-weeks">
              {weeks.map((week) => (
                <section className="print-week" key={week.index}>
                  <h3>{week.label}</h3>
                  <div className="print-table-wrap">
                    <table className="print-table">
                      <thead>
                        <tr>
                          <th scope="col">Time</th>
                          {week.days.map((day) => (
                            <th scope="col" key={day}>
                              {DAY_NAMES[day]}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {week.rows.map((row) => (
                          <tr
                            key={row.period.id}
                            className={row.structural ? "print-structural" : ""}
                          >
                            <th scope="row">
                              <strong>{row.period.name}</strong>
                              <span>
                                {row.period.startTime}–{row.period.endTime}
                              </span>
                            </th>
                            {row.structural ? (
                              <td colSpan={week.days.length}>
                                {row.period.name}
                              </td>
                            ) : (
                              row.cells.map((cell, i) => (
                                <td
                                  key={i}
                                  style={
                                    cell
                                      ? {
                                          backgroundColor: `${cell.colour}1c`,
                                          borderLeftColor: cell.colour,
                                        }
                                      : undefined
                                  }
                                >
                                  {cell ? (
                                    <>
                                      <strong>{cell.title}</strong>
                                      {cell.room && <span>{cell.room}</span>}
                                      {cell.teacher && (
                                        <small>{cell.teacher}</small>
                                      )}
                                    </>
                                  ) : (
                                    <span className="print-empty">—</span>
                                  )}
                                </td>
                              ))
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              ))}
            </div>
            <footer className="print-footer">
              <span>
                {p.academicYear.timezone} · {p.cycleLength}-week rotation
              </span>
              <span>
                {pageIndex + 1} / {pages.length}
              </span>
            </footer>
          </article>
        ))}
      </div>
    </div>
  );
}
