import { useState } from "react";
import {
  ArrowRight,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronUp,
  Clock3,
  Copy,
  Pencil,
  Plus,
  RotateCcw,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
import {
  COLOURS,
  DAY_NAMES,
  newId,
  sortedPeriods,
  WEEKDAYS,
  type DateExclusion,
  type Period,
  type Subject,
  type TimetableProject,
} from "../domain/model";
import { dateRange, formatDate, validDate, validTime } from "../domain/dates";
import { getRotationLabel, getTeachingWeeks } from "../domain/rotation";
import { standardPeriods } from "../domain/fixture";
import { EmptyState, Field, Modal, Notice } from "./ui";

export interface SettingsProps {
  project: TimetableProject;
  update: (change: (p: TimetableProject) => TimetableProject) => void;
}
const timezones = [
  ...new Set([
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    "UTC",
    "Europe/London",
    ...Intl.supportedValuesOf("timeZone"),
  ]),
].sort();

export function SchoolYear({
  project: p,
  update,
  sample,
  isNew,
}: SettingsProps & { sample: () => void; isNew: boolean }) {
  const a = p.academicYear;
  const change = (patch: Partial<typeof a>) =>
    update((p) => ({ ...p, academicYear: { ...p.academicYear, ...patch } }));
  return (
    <div className="setup-columns">
      <section className="panel year-form">
        <div className="section-heading">
          <h2>Your school year</h2>
          <CalendarDays size={20} className="muted" />
        </div>
        <Field
          label="Timetable name"
          hint="Something you'll recognise in your calendar."
        >
          <input
            autoComplete="off"
            maxLength={120}
            placeholder="e.g. My school timetable"
            value={p.name}
            onChange={(e) => update((p) => ({ ...p, name: e.target.value }))}
          />
        </Field>
        <div className="form-grid">
          <Field label="First day of school">
            <input
              type="date"
              min="1900-01-01"
              max="2200-12-31"
              value={a.startDate}
              onChange={(e) => change({ startDate: e.target.value })}
            />
          </Field>
          <Field label="Last day of school">
            <input
              type="date"
              min={a.startDate || "1900-01-01"}
              max="2200-12-31"
              value={a.endDate}
              onChange={(e) => change({ endDate: e.target.value })}
            />
          </Field>
        </div>
        <fieldset className="field">
          <legend>Which days do you go to school?</legend>
          <div className="weekday-options">
            {WEEKDAYS.map((day) => (
              <button
                type="button"
                key={day}
                aria-pressed={a.schoolWeekdays.includes(day)}
                className={a.schoolWeekdays.includes(day) ? "selected" : ""}
                onClick={() =>
                  change({
                    schoolWeekdays: a.schoolWeekdays.includes(day)
                      ? a.schoolWeekdays.filter((d) => d !== day)
                      : [...a.schoolWeekdays, day],
                  })
                }
              >
                {DAY_NAMES[day].slice(0, 3)}
              </button>
            ))}
          </div>
        </fieldset>
        <Field
          label="School time zone"
          hint="Lesson times stay the same when the clocks change."
        >
          <input
            list="timezones"
            value={a.timezone}
            onChange={(e) => change({ timezone: e.target.value })}
          />
          <datalist id="timezones">
            {timezones.map((zone) => (
              <option key={zone} value={zone} />
            ))}
          </datalist>
        </Field>
      </section>
      <aside className="setup-aside">
        <div className="intro-card">
          <span className="eyebrow">A little setup. A whole year sorted.</span>
          <h2>
            Your school week,
            <br />
            <em>in your calendar.</em>
          </h2>
          <p>
            Set up once. We'll take care of the weeks, holidays, and every
            lesson in between.
          </p>
          <ol className="benefits">
            <li>
              <span>01</span>
              <div>
                <strong>Make it yours</strong>
                <small>Your subjects, lesson times, and school days.</small>
              </div>
            </li>
            <li>
              <span>02</span>
              <div>
                <strong>Fill your week in minutes</strong>
                <small>Pick a subject. Tap to place it. Done.</small>
              </div>
            </li>
            <li>
              <span>03</span>
              <div>
                <strong>Take it with you</strong>
                <small>Print a copy or add it to your calendar.</small>
              </div>
            </li>
          </ol>
          <div className="privacy-line">
            <ShieldCheck size={18} />
            <span>Private by design. Saved on your device.</span>
          </div>
        </div>
        {isNew && (
          <button className="sample-link" onClick={sample}>
            Want to have a look first?{" "}
            <strong>
              Try a sample <ArrowRight size={15} />
            </strong>
          </button>
        )}
      </aside>
    </div>
  );
}

export function Rotation({ project: p, update }: SettingsProps) {
  const label = (i: number) => getRotationLabel(i, p.rotationLabelStyle);
  return (
    <div className="settings-width">
      <section className="panel">
        <h2>Your timetable rhythm</h2>
        <fieldset className="field">
          <legend>How many weeks are in your timetable rotation?</legend>
          <div className="choice-grid">
            {([1, 2, 3, 4] as const).map((length) => (
              <button
                key={length}
                className={`choice ${p.cycleLength === length ? "selected" : ""}`}
                aria-pressed={p.cycleLength === length}
                onClick={() =>
                  update((p) => ({
                    ...p,
                    cycleLength: length,
                    initialRotationIndex: Math.min(
                      p.initialRotationIndex,
                      length - 1,
                    ),
                  }))
                }
              >
                <strong>{length}</strong>
                <span>{length === 1 ? "Same every week" : "week cycle"}</span>
                {p.cycleLength === length && <Check size={15} />}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset className="field">
          <legend>How does your school name the weeks?</legend>
          <div className="form-grid">
            {(["numbers", "letters"] as const).map((style) => (
              <button
                key={style}
                className={`label-choice ${p.rotationLabelStyle === style ? "selected" : ""}`}
                aria-pressed={p.rotationLabelStyle === style}
                onClick={() =>
                  update((p) => ({ ...p, rotationLabelStyle: style }))
                }
              >
                <span>{style === "numbers" ? "Numbers" : "Letters"}</span>
                <strong>
                  {Array.from({ length: p.cycleLength }, (_, i) =>
                    getRotationLabel(i, style),
                  ).join(" · ")}
                </strong>
              </button>
            ))}
          </div>
        </fieldset>
        <Field
          label="Which timetable week is the first week of school?"
          hint="Even if term starts midweek, those first few days use this week."
        >
          <select
            value={p.initialRotationIndex}
            onChange={(e) =>
              update((p) => ({ ...p, initialRotationIndex: +e.target.value }))
            }
          >
            {Array.from({ length: p.cycleLength }, (_, i) => (
              <option key={i} value={i}>
                {label(i)}
              </option>
            ))}
          </select>
        </Field>
        <Notice>
          Only weeks with school days move your rotation forward. A full week
          off doesn't use up a timetable week.
        </Notice>
        <div className="rotation-illustration" aria-label="Rotation example">
          <span>{label(p.initialRotationIndex)}</span>
          <ArrowRight size={17} />
          <span className="holiday-chip">Holiday</span>
          <ArrowRight size={17} />
          <span>{label((p.initialRotationIndex + 1) % p.cycleLength)}</span>
        </div>
      </section>
      {p.entries.some((e) => e.rotationIndex >= p.cycleLength) && (
        <Notice>
          Lessons in hidden rotation weeks are kept. Increase the cycle again to
          bring them back.
        </Notice>
      )}
    </div>
  );
}

export function Holidays({ project: p, update }: SettingsProps) {
  const [draft, setDraft] = useState<DateExclusion | null>(null);
  const [error, setError] = useState("");
  const exclusions = [...p.academicYear.exclusions].sort((a, b) =>
    a.startDate.localeCompare(b.startDate),
  );
  const weeks = getTeachingWeeks(p);
  const add = () => {
    setError("");
    setDraft({
      id: newId(),
      name: "",
      startDate: "",
      endDate: "",
      resetRotationAfter: false,
    });
  };
  return (
    <div className="settings-width">
      <div className="section-heading">
        <div>
          <h2>
            Holidays & days off{" "}
            <span className="count">{exclusions.length}</span>
          </h2>
          <p className="muted">No lessons will be added on these dates.</p>
        </div>
        <button
          className="button secondary"
          onClick={add}
          disabled={exclusions.length >= 200}
        >
          <Plus size={17} />
          Add days off
        </button>
      </div>
      {draft && (
        <form
          className="panel inline-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (
              !validDate(draft.startDate) ||
              !validDate(draft.endDate) ||
              draft.endDate < draft.startDate
            ) {
              setError("Choose a valid end date on or after the start date.");
              return;
            }
            update((p) => ({
              ...p,
              academicYear: {
                ...p.academicYear,
                exclusions: [
                  ...p.academicYear.exclusions.filter(
                    (item) => item.id !== draft.id,
                  ),
                  { ...draft, name: draft.name.trim() },
                ],
              },
            }));
            setDraft(null);
            setError("");
          }}
        >
          <div className="section-heading">
            <h3>
              {exclusions.some((e) => e.id === draft.id)
                ? "Edit days off"
                : "Add days off"}
            </h3>
            <button
              className="icon-button"
              type="button"
              onClick={() => setDraft(null)}
              aria-label="Cancel holiday"
            >
              <X size={18} />
            </button>
          </div>
          <Field label="Name">
            <input
              autoFocus
              required
              maxLength={120}
              placeholder="e.g. October half-term"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </Field>
          <div className="form-grid">
            <Field label="Start date">
              <input
                type="date"
                required
                min="1900-01-01"
                max="2200-12-31"
                value={draft.startDate}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    startDate: e.target.value,
                    endDate: draft.endDate || e.target.value,
                  })
                }
              />
            </Field>
            <Field label="End date" hint="For one day off, use the same date.">
              <input
                type="date"
                required
                min={draft.startDate}
                max="2200-12-31"
                value={draft.endDate}
                onChange={(e) =>
                  setDraft({ ...draft, endDate: e.target.value })
                }
              />
            </Field>
          </div>
          <fieldset className="field">
            <legend>
              Does the timetable rotation reset after this holiday?
            </legend>
            <label className="radio-card">
              <input
                type="radio"
                name="reset"
                checked={!draft.resetRotationAfter}
                onChange={() =>
                  setDraft({ ...draft, resetRotationAfter: false })
                }
              />
              <span>
                <strong>No, continue the rotation</strong>
                <small>
                  The first week back follows the last teaching week before the
                  holiday.
                </small>
              </span>
            </label>
            <label className="radio-card">
              <input
                type="radio"
                name="reset"
                checked={draft.resetRotationAfter}
                onChange={() =>
                  setDraft({ ...draft, resetRotationAfter: true })
                }
              />
              <span>
                <strong>Yes, reset the rotation</strong>
                <small>
                  The first teaching week back starts again at{" "}
                  {getRotationLabel(0, p.rotationLabelStyle)}.
                </small>
              </span>
            </label>
          </fieldset>
          {error && <Notice kind="error">{error}</Notice>}
          <button className="button primary" type="submit">
            <Check size={17} />
            Save days off
          </button>
        </form>
      )}
      {!exclusions.length && !draft ? (
        <EmptyState
          title="Leave the days off out"
          action="Add your first holiday"
          onAction={add}
        >
          Add school holidays, inset days, and any other days without lessons.
          You can come back to this later.
        </EmptyState>
      ) : (
        <div className="holiday-list">
          {exclusions.map((e) => {
            const back = weeks.find((w) =>
              w.dates.some((date) => date > e.endDate),
            );
            const backDate = back?.dates.find((date) => date > e.endDate);
            const overlap = exclusions.some(
              (other) =>
                other.id !== e.id &&
                e.startDate <= other.endDate &&
                e.endDate >= other.startDate,
            );
            return (
              <article className="holiday-card" key={e.id}>
                <div className="date-tile">
                  <small>{formatDate(e.startDate, { month: "short" })}</small>
                  <strong>{formatDate(e.startDate, { day: "numeric" })}</strong>
                </div>
                <div className="holiday-info">
                  <h3>{e.name}</h3>
                  <p>{dateRange(e.startDate, e.endDate)}</p>
                  <span className={e.resetRotationAfter ? "tag green" : "tag"}>
                    {e.resetRotationAfter ? (
                      <RotateCcw size={12} />
                    ) : (
                      <ArrowRight size={12} />
                    )}
                    {e.resetRotationAfter
                      ? `Reset to ${getRotationLabel(0, p.rotationLabelStyle)}`
                      : "Continue rotation"}
                  </span>
                  {back && (
                    <small className="back-note">
                      Back {formatDate(backDate!)} ·{" "}
                      {getRotationLabel(
                        back.rotationIndex,
                        p.rotationLabelStyle,
                      )}
                    </small>
                  )}
                  {overlap && (
                    <small className="warning-text">
                      Overlaps another holiday; dates are excluded once.
                    </small>
                  )}
                </div>
                <div className="row-actions">
                  <button
                    className="icon-button"
                    aria-label={`Edit ${e.name}`}
                    onClick={() => {
                      setDraft(e);
                      setError("");
                    }}
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    className="icon-button"
                    aria-label={`Delete ${e.name}`}
                    onClick={() => {
                      if (window.confirm(`Delete ${e.name}?`))
                        update((p) => ({
                          ...p,
                          academicYear: {
                            ...p.academicYear,
                            exclusions: p.academicYear.exclusions.filter(
                              (h) => h.id !== e.id,
                            ),
                          },
                        }));
                    }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

const periodTypes: Period["type"][] = [
  "lesson",
  "registration",
  "break",
  "lunch",
  "other",
];
const periodTypeLabel = (type: Period["type"]) =>
  type[0].toUpperCase() + type.slice(1);

export function Periods({ project: p, update }: SettingsProps) {
  const periods = sortedPeriods(p);
  const [draft, setDraft] = useState<Period | null>(null);
  const [error, setError] = useState("");
  const changeDraft = (patch: Partial<Period>) => {
    setDraft((current) => (current ? { ...current, ...patch } : null));
    setError("");
  };
  const defaultName = (type: Period["type"]) =>
    type === "lesson"
      ? `Period ${p.periods.filter((period) => period.type === "lesson").length + 1}`
      : type[0].toUpperCase() + type.slice(1);
  const change = (id: string, patch: Partial<Period>) =>
    update((p) => ({
      ...p,
      periods: p.periods.map((period) =>
        period.id === id ? { ...period, ...patch } : period,
      ),
    }));
  const move = (index: number, direction: number) => {
    const next = [...periods];
    [next[index], next[index + direction]] = [
      next[index + direction],
      next[index],
    ];
    update((p) => ({
      ...p,
      periods: next.map((period, sortOrder) => ({ ...period, sortOrder })),
    }));
  };
  const add = () => {
    setError("");
    setDraft({
      id: newId(),
      name: defaultName("lesson"),
      startTime: periods.at(-1)?.endTime || "",
      endTime: "",
      type: "lesson",
      sortOrder: periods.length,
    });
  };
  return (
    <div>
      <div className="section-heading">
        <div>
          <h2>The shape of your school day</h2>
          <p className="muted">
            Add lessons, registration, breaks or lunch. Edit any name or time
            below, and use the arrows or bin to reorder or delete a period.
          </p>
        </div>
        <button
          className="button secondary"
          onClick={add}
          disabled={periods.length >= 40}
        >
          <Plus size={17} />
          Add period
        </button>
      </div>
      {draft && (
        <Modal title="Add a period" onClose={() => setDraft(null)}>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (!draft.name.trim()) {
                setError("Give this period a name.");
                return;
              }
              if (
                !validTime(draft.startTime) ||
                !validTime(draft.endTime) ||
                draft.endTime <= draft.startTime
              ) {
                setError(
                  "Choose start and end times. End must be later than start.",
                );
                return;
              }
              update((current) => {
                if (current.periods.length >= 40) return current;
                const next = sortedPeriods(current);
                const insertion = next.findIndex(
                  (period) => period.startTime > draft.startTime,
                );
                next.splice(insertion < 0 ? next.length : insertion, 0, {
                  ...draft,
                  name: draft.name.trim(),
                });
                return {
                  ...current,
                  periods: next.map((period, sortOrder) => ({
                    ...period,
                    sortOrder,
                  })),
                };
              });
              setDraft(null);
            }}
          >
            {error && <Notice kind="error">{error}</Notice>}
            <Field label="Period type">
              <select
                autoFocus
                value={draft.type}
                onChange={(event) => {
                  const type = event.target.value as Period["type"];
                  changeDraft({
                    type,
                    name:
                      draft.name === defaultName(draft.type)
                        ? defaultName(type)
                        : draft.name,
                  });
                }}
              >
                {periodTypes.map((type) => (
                  <option key={type} value={type}>
                    {periodTypeLabel(type)}
                  </option>
                ))}
              </select>
            </Field>
            <Field
              label="Period name"
              hint="Use any name, such as Tutor period or Afternoon break."
            >
              <input
                required
                maxLength={80}
                value={draft.name}
                onChange={(event) => changeDraft({ name: event.target.value })}
              />
            </Field>
            <div className="form-grid">
              <Field label="Start time">
                <input
                  required
                  type="time"
                  value={draft.startTime}
                  onChange={(event) =>
                    changeDraft({ startTime: event.target.value })
                  }
                />
              </Field>
              <Field label="End time">
                <input
                  required
                  type="time"
                  value={draft.endTime}
                  onChange={(event) =>
                    changeDraft({ endTime: event.target.value })
                  }
                />
              </Field>
            </div>
            <p className="muted small">
              Registration, breaks and lunch appear automatically each school
              day and cannot be assigned a subject. New periods are inserted by
              start time.
            </p>
            <div className="form-actions">
              <button
                type="button"
                className="button secondary"
                onClick={() => setDraft(null)}
              >
                Cancel
              </button>
              <button type="submit" className="button primary">
                <Plus size={17} />
                Save period
              </button>
            </div>
          </form>
        </Modal>
      )}
      {!periods.length ? (
        <div className="panel">
          <EmptyState
            title="Every school day has its rhythm"
            action="Use a standard school day"
            onAction={() =>
              update((p) => ({ ...p, periods: standardPeriods() }))
            }
          >
            Start with registration, five lessons, break, and lunch. Adjust
            everything to fit your school.
          </EmptyState>
        </div>
      ) : (
        <div className="panel periods-panel">
          <div className="period-head">
            <span>Period / block</span>
            <span>Start</span>
            <span>End</span>
            <span>Type</span>
            <span>Order</span>
          </div>
          {periods.map((period, i) => (
            <div className="period-item" key={period.id}>
              <div className="period-row">
                <input
                  aria-label={`Period ${i + 1} label`}
                  maxLength={80}
                  value={period.name}
                  onChange={(e) => change(period.id, { name: e.target.value })}
                />
                <label className="period-time period-start">
                  <span>Start</span>
                  <input
                    type="time"
                    aria-label={`${period.name} start time`}
                    value={period.startTime}
                    onChange={(e) =>
                      change(period.id, { startTime: e.target.value })
                    }
                  />
                </label>
                <label className="period-time period-end">
                  <span>End</span>
                  <input
                    type="time"
                    aria-label={`${period.name} end time`}
                    value={period.endTime}
                    onChange={(e) =>
                      change(period.id, { endTime: e.target.value })
                    }
                  />
                </label>
                <select
                  aria-label={`${period.name} type`}
                  value={period.type}
                  onChange={(e) =>
                    change(period.id, {
                      type: e.target.value as Period["type"],
                    })
                  }
                >
                  {periodTypes.map((type) => (
                    <option key={type} value={type}>
                      {periodTypeLabel(type)}
                    </option>
                  ))}
                </select>
                <div className="row-actions">
                  <button
                    className="icon-button"
                    aria-label={`Move ${period.name} up`}
                    disabled={i === 0}
                    onClick={() => move(i, -1)}
                  >
                    <ChevronUp size={16} />
                  </button>
                  <button
                    className="icon-button"
                    aria-label={`Move ${period.name} down`}
                    disabled={i === periods.length - 1}
                    onClick={() => move(i, 1)}
                  >
                    <ChevronDown size={16} />
                  </button>
                  <button
                    className="icon-button"
                    aria-label={`Delete ${period.name}`}
                    onClick={() => {
                      if (
                        window.confirm(
                          `Delete ${period.name} and any lessons in this period?`,
                        )
                      )
                        update((p) => ({
                          ...p,
                          periods: p.periods.filter((x) => x.id !== period.id),
                          entries: p.entries.filter(
                            (e) => e.periodId !== period.id,
                          ),
                        }));
                    }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              {(!validTime(period.startTime) ||
                !validTime(period.endTime) ||
                period.endTime <= period.startTime) && (
                <small className="warning-text">
                  Choose start and end times. End must be later than start.
                </small>
              )}
            </div>
          ))}
        </div>
      )}
      <div className="tip-line">
        <Clock3 size={17} />
        <span>
          Registration, breaks and lunch appear automatically without a subject.
          Rename registration to “Tutor period” or add as many breaks as your
          school day needs. They're left out of your calendar by default.
        </span>
      </div>
    </div>
  );
}

export function SubjectForm({
  subject,
  onSave,
  onCancel,
}: {
  subject?: Subject;
  onSave: (subject: Subject) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<Subject>(
    subject ?? {
      id: newId(),
      name: "",
      shortName: "",
      teacher: "",
      room: "",
      colour: COLOURS[0],
    },
  );
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (draft.name.trim()) onSave({ ...draft, name: draft.name.trim() });
      }}
      className="subject-form"
    >
      <div className="form-grid">
        <Field label="Subject name">
          <input
            autoFocus
            required
            maxLength={120}
            placeholder="e.g. Mathematics"
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />
        </Field>
        <Field label="Short name (optional)">
          <input
            maxLength={30}
            placeholder="e.g. Maths"
            value={draft.shortName ?? ""}
            onChange={(e) => setDraft({ ...draft, shortName: e.target.value })}
          />
        </Field>
      </div>
      <div className="form-grid">
        <Field label="Default teacher (optional)">
          <input
            maxLength={120}
            placeholder="e.g. Mrs Jones"
            value={draft.teacher ?? ""}
            onChange={(e) => setDraft({ ...draft, teacher: e.target.value })}
          />
        </Field>
        <Field label="Default room (optional)">
          <input
            maxLength={120}
            placeholder="e.g. M12"
            value={draft.room ?? ""}
            onChange={(e) => setDraft({ ...draft, room: e.target.value })}
          />
        </Field>
      </div>
      <fieldset className="field">
        <legend>Subject colour</legend>
        <div className="colour-options">
          {COLOURS.map((colour, i) => (
            <button
              type="button"
              key={colour}
              style={{ backgroundColor: colour }}
              aria-label={`Colour ${i + 1}`}
              aria-pressed={draft.colour === colour}
              onClick={() => setDraft({ ...draft, colour })}
            >
              {draft.colour === colour && <Check size={18} />}
            </button>
          ))}
          <input
            type="color"
            aria-label="Custom subject colour"
            value={draft.colour}
            onChange={(e) => setDraft({ ...draft, colour: e.target.value })}
          />
        </div>
      </fieldset>
      <p className="muted small">
        Teacher and room are reused every time you place this subject. You can
        change them for individual lessons.
      </p>
      <div className="form-actions">
        <button type="button" className="button secondary" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="button primary">
          <Check size={17} />
          Save subject
        </button>
      </div>
    </form>
  );
}

type SubjectEditor =
  | { kind: "new" }
  | { kind: "edit"; subject: Subject }
  | { kind: "duplicate"; subject: Subject; sourceId: string };

export function Subjects({ project: p, update }: SettingsProps) {
  const [editing, setEditing] = useState<SubjectEditor | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const move = (subject: Subject, direction: -1 | 1) => {
    update((current) => {
      const index = current.subjects.findIndex((s) => s.id === subject.id);
      const destination = index + direction;
      if (
        index < 0 ||
        destination < 0 ||
        destination >= current.subjects.length
      )
        return current;
      const subjects = [...current.subjects];
      [subjects[index], subjects[destination]] = [
        subjects[destination],
        subjects[index],
      ];
      return { ...current, subjects };
    });
    const position =
      p.subjects.findIndex((s) => s.id === subject.id) + direction + 1;
    setAnnouncement(
      `${subject.name} moved to position ${position} of ${p.subjects.length}.`,
    );
  };
  return (
    <div className="settings-width">
      <div className="section-heading">
        <div>
          <h2>
            Your subject library{" "}
            <span className="count">{p.subjects.length}</span>
          </h2>
          <p className="muted">
            Duplicate a subject for a different teacher or room. Use the arrows
            to set the order in your timetable picker.
          </p>
        </div>
        <button
          className="button secondary"
          onClick={() => setEditing({ kind: "new" })}
          disabled={p.subjects.length >= 100}
        >
          <Plus size={17} />
          Add subject
        </button>
      </div>
      <span className="sr-only" role="status">
        {announcement}
      </span>
      {editing && (
        <Modal
          title={
            editing.kind === "new"
              ? "Add a subject"
              : `${editing.kind === "duplicate" ? "Duplicate" : "Edit"} ${editing.subject.name}`
          }
          onClose={() => setEditing(null)}
        >
          {editing.kind === "duplicate" && (
            <p className="muted small subject-copy-hint">
              Change the teacher or room for this copy, then save it to your
              library.
            </p>
          )}
          <SubjectForm
            key={editing.kind === "new" ? "new" : editing.subject.id}
            subject={editing.kind === "new" ? undefined : editing.subject}
            onCancel={() => setEditing(null)}
            onSave={(subject) => {
              update((current) => {
                if (editing.kind === "edit")
                  return {
                    ...current,
                    subjects: current.subjects.map((s) =>
                      s.id === subject.id ? subject : s,
                    ),
                  };
                if (current.subjects.length >= 100) return current;
                const subjects = [...current.subjects];
                const source =
                  editing.kind === "duplicate"
                    ? subjects.findIndex((s) => s.id === editing.sourceId)
                    : -1;
                subjects.splice(
                  source < 0 ? subjects.length : source + 1,
                  0,
                  subject,
                );
                return { ...current, subjects };
              });
              setAnnouncement(
                `${subject.name} ${editing.kind === "duplicate" ? "duplicated" : "saved"}.`,
              );
              setEditing(null);
            }}
          />
        </Modal>
      )}
      {!p.subjects.length ? (
        <EmptyState
          title="What are you learning?"
          action="Add your first subject"
          onAction={() => setEditing({ kind: "new" })}
        >
          Give each subject a colour, and add its usual teacher and room. No
          more entering the same details twice.
        </EmptyState>
      ) : (
        <div className="subject-cards">
          {p.subjects.map((subject, index) => (
            <article
              className="subject-card"
              key={subject.id}
              aria-labelledby={`subject-${subject.id}`}
            >
              <span
                className="subject-initial"
                style={{
                  backgroundColor: `${subject.colour}22`,
                  borderColor: subject.colour,
                }}
              >
                {(subject.shortName || subject.name).slice(0, 2)}
              </span>
              <div className="subject-details">
                <h3 id={`subject-${subject.id}`}>{subject.name}</h3>
                <p>
                  {[subject.teacher, subject.room]
                    .filter(Boolean)
                    .join(" · ") || "No default teacher or room"}
                </p>
              </div>
              <div className="row-actions subject-order">
                <button
                  className="icon-button"
                  aria-label={`Move ${subject.name} up`}
                  title="Move up"
                  disabled={index === 0}
                  onClick={() => move(subject, -1)}
                >
                  <ChevronUp size={17} />
                </button>
                <button
                  className="icon-button"
                  aria-label={`Move ${subject.name} down`}
                  title="Move down"
                  disabled={index === p.subjects.length - 1}
                  onClick={() => move(subject, 1)}
                >
                  <ChevronDown size={17} />
                </button>
              </div>
              <div className="row-actions subject-actions">
                <button
                  className="button text-button duplicate-subject"
                  aria-label={`Duplicate ${subject.name}`}
                  disabled={p.subjects.length >= 100}
                  onClick={() =>
                    setEditing({
                      kind: "duplicate",
                      subject: { ...subject, id: newId() },
                      sourceId: subject.id,
                    })
                  }
                >
                  <Copy size={16} />
                  Duplicate
                </button>
                <button
                  className="icon-button"
                  aria-label={`Edit ${subject.name}`}
                  title="Edit subject"
                  onClick={() => setEditing({ kind: "edit", subject })}
                >
                  <Pencil size={16} />
                </button>
                <button
                  className="icon-button"
                  aria-label={`Delete ${subject.name}`}
                  title="Delete subject"
                  onClick={() => {
                    if (
                      window.confirm(
                        `Delete ${subject.name} and all its timetable entries?`,
                      )
                    )
                      update((p) => ({
                        ...p,
                        subjects: p.subjects.filter((s) => s.id !== subject.id),
                        entries: p.entries.filter(
                          (e) => e.subjectId !== subject.id,
                        ),
                      }));
                  }}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
