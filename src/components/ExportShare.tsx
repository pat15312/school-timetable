import { useMemo, useState } from "react";
import { Download, Share2, ShieldCheck, Upload } from "lucide-react";
import type { TimetableProject } from "../domain/model";
import { buildCalendar, safeFilename } from "../domain/calendar";
import { useCalendar } from "../hooks/useCalendar";
import { CalendarOptions } from "./CalendarOptions";
import { CalendarStatus } from "./CalendarStatus";
import { DeviceTransfer } from "./DeviceTransfer";
import { downloadFile, Notice } from "./ui";

export function ExportShare({
  project: p,
  includeFixedPeriods,
  onIncludeFixedPeriodsChange,
  notify,
  navigate,
  onBackup,
  onImport,
}: {
  project: TimetableProject;
  includeFixedPeriods: boolean;
  onIncludeFixedPeriodsChange: (value: boolean) => void;
  notify: (message: string) => void;
  navigate: (page: string) => void;
  onBackup: () => void;
  onImport: () => void;
}) {
  const [exported, setExported] = useState(false);
  const [exportError, setExportError] = useState("");
  const [sharing, setSharing] = useState(false);
  const [shareUnavailable, setShareUnavailable] = useState(false);
  const { validation, occurrences, lessons, valid } = useCalendar(
    p,
    includeFixedPeriods,
  );
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
    <div className="export-share-page page-stack">
      <p className="muted">
        For <strong>{p.name || "Untitled timetable"}</strong>
      </p>
      <section className="panel export-card">
        <div className="section-heading">
          <div>
            <h2>Add to your calendar app</h2>
            <p className="muted">
              Add your timetable to Apple Calendar, Google Calendar, Outlook, or
              another calendar app.
            </p>
          </div>
          <Download size={20} className="muted" />
        </div>
        <CalendarStatus
          project={p}
          validation={validation}
          hasLessons={!!lessons.length}
          navigate={navigate}
        />
        <div className="export-options">
          <div>
            <CalendarOptions
              value={includeFixedPeriods}
              onChange={(value) => {
                onIncludeFixedPeriodsChange(value);
                setExported(false);
              }}
            />
          </div>
          <div className="export-actions">
            <div className="page-actions">
              <button
                className="button primary"
                disabled={!calendar?.file || sharing}
                onClick={() => void exportCalendar(false)}
              >
                <Download size={17} />
                Download calendar
              </button>
              {(canShare || shareUnavailable) && (
                <button
                  className="button secondary"
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
                      : "Share calendar"}
                </button>
              )}
            </div>
            {(canShare || shareUnavailable) && (
              <small
                id="calendar-share-help"
                className="export-file-note export-share-help"
              >
                {shareUnavailable
                  ? "Your browser couldn’t open sharing. Download the .ics file, then attach it in your preferred app."
                  : "Share calendar file opens your device’s sharing menu to send the .ics file through another app. This typically only works on mobile devices."}
              </small>
            )}
            <small className="export-file-note">
              {occurrences.length.toLocaleString()} events · .ics calendar file
            </small>
            {(calendar?.error || exportError) && (
              <Notice kind="error">{calendar?.error || exportError}</Notice>
            )}
          </div>
        </div>

        {exported && (
          <Notice kind="success">
            Your calendar contains individual lessons for the selected school
            year. Holidays and days off have already been removed.
          </Notice>
        )}

        <details className="import-tips">
          <summary>How to add the file to your calendar</summary>
          <div className="import-tip-grid">
            <p>
              <strong>Apple Calendar &amp; Outlook</strong>
              <br />
              Open the downloaded .ics file and choose a calendar.
            </p>
            <p>
              <strong>Google Calendar</strong>
              <br />
              On a computer, open Settings → Import &amp; export, then choose
              the file.
            </p>
            <p>
              Import into a separate school calendar. When replacing a previous
              export, remove its old events first to avoid duplicates.
            </p>
          </div>
        </details>
      </section>

      <DeviceTransfer project={p} notify={notify} onBackup={onBackup} />
      <section className="panel backup-card">
        <div className="section-heading">
          <div>
            <h2>Back up or restore</h2>
            <p className="muted">
              Save a backup of your entire SchoolCal configuration.
            </p>
          </div>
          <ShieldCheck size={20} className="muted" />
        </div>
        <div className="page-actions">
          <button className="button secondary" onClick={onBackup}>
            <Download size={16} />
            Download backup (.json)
          </button>
          <button className="button secondary" onClick={onImport}>
            <Upload size={16} />
            Import backup (.json)
          </button>
        </div>
        <p className="muted small">
          Importing a backup asks for confirmation before replacing the
          timetable on this device.
        </p>
      </section>
    </div>
  );
}
