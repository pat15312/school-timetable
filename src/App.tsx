import { Fragment, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  ChevronsUpDown,
  Clock3,
  Download,
  Grid2X2,
  HelpCircle,
  Leaf,
  Menu,
  Plus,
  Printer,
  RotateCcw,
  ShieldCheck,
  Share2,
  X,
} from "lucide-react";
import { BRAND } from "./brand";
import type { TimetableProject } from "./domain/model";
import { sampleProject } from "./domain/fixture";
import { daysBetween, validDate, validTimezone } from "./domain/dates";
import { safeFilename } from "./domain/calendar";
import { parseProject, serializeProject } from "./domain/persistence";
import { validateProject } from "./domain/validation";
import { useProject } from "./hooks/useProject";
import {
  Holidays,
  Periods,
  Rotation,
  SchoolYear,
  Subjects,
} from "./components/Setup";
import { Timetable } from "./components/Timetable";
import { LessonPreview } from "./components/LessonPreview";
import { ExportShare } from "./components/ExportShare";
import { PrintView } from "./components/PrintView";
import { ThemeControl } from "./components/ThemeControl";
import { TimetableSwitcher } from "./components/TimetableSwitcher";
import { TransferImport } from "./components/TransferImport";
import { Modal, Notice, downloadFile } from "./components/ui";

const STEPS = [
  {
    id: "year",
    name: "School year",
    icon: CalendarDays,
    title: "Let’s start with your school year.",
    subtitle: "Set your school dates, school days and time zone.",
  },
  {
    id: "rotation",
    name: "Timetable rotation",
    icon: RotateCcw,
    title: "Set your timetable pattern.",
    subtitle: "Choose a one- to four-week cycle and its starting week.",
  },
  {
    id: "holidays",
    name: "Holidays & days off",
    icon: Leaf,
    title: "Make room for the days off.",
    subtitle: "Add holidays, inset days and other dates without lessons.",
  },
  {
    id: "periods",
    name: "Lesson times",
    icon: Clock3,
    title: "A school day, your way.",
    subtitle:
      "Set the start and end times for lessons, breaks and other periods.",
  },
  {
    id: "subjects",
    name: "Subjects",
    icon: BookOpen,
    title: "Bring your subjects together.",
    subtitle: "Add subjects, colours, teachers and rooms for your lessons.",
  },
  {
    id: "timetable",
    name: "Build timetable",
    icon: Grid2X2,
    title: "Your week, taking shape.",
    subtitle: "Choose a subject, then select the cells where it is taught.",
  },
  {
    id: "preview",
    name: "Lesson preview",
    title: "Your lessons, on real dates.",
    subtitle:
      "Check any teaching week, with holidays and days off taken into account.",
    icon: CalendarDays,
  },
] as const;
const EXTRA_PAGES = [
  {
    id: "export",
    name: "Export & share",
    title: "Take your timetable with you.",
    subtitle:
      "Download a calendar file, back up your settings or copy your timetable to another device.",
    icon: Share2,
  },
  {
    id: "print",
    name: "Print timetable",
    title: "Your timetable, ready to print.",
    subtitle: "Choose a layout, then print your timetable or save it as a PDF.",
    icon: Printer,
  },
] as const;
const validPages: string[] = [
  ...STEPS.map((step) => step.id),
  ...EXTRA_PAGES.map((page) => page.id),
];
// Keep old bookmarks useful; the final saved setup-step index remains 6.
const resolvePage = (page: string) =>
  page === "review" || page === "overview" ? "preview" : page;
type InstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
};

export default function App() {
  const state = useProject(),
    { project: p, update, includeFixedPeriods, setIncludeFixedPeriods } = state;
  const [page, setPage] = useState<string>(() => {
    const hash = resolvePage(window.location.hash.slice(1));
    return validPages.includes(hash as (typeof validPages)[number])
      ? hash
      : p.setupComplete
        ? "timetable"
        : STEPS[p.setupStep].id;
  });
  const [timetablesOpen, setTimetablesOpen] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [incomingTransfer, setIncomingTransfer] = useState<string | null>(() =>
    window.location.hash.startsWith("#transfer=") ? window.location.hash : null,
  );
  const [narrow, setNarrow] = useState(
    () => window.matchMedia("(max-width: 780px)").matches,
  );
  const [toast, setToast] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [help, setHelp] = useState(false);
  const [installHelp, setInstallHelp] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<InstallPrompt | null>(
    null,
  );
  const [updateReady, setUpdateReady] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const main = useRef<HTMLElement>(null);
  const sidebar = useRef<HTMLElement>(null);
  const notify = (message: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(message);
    toastTimer.current = setTimeout(() => setToast(""), 4500);
  };
  const navigate = (destination: string, trackSetup = true) => {
    const next = resolvePage(destination);
    if (!validPages.includes(next as (typeof validPages)[number])) return;
    setPage(next);
    setErrors([]);
    setMobileNav(false);
    window.location.hash = next;
    const index = STEPS.findIndex((step) => step.id === next);
    if (trackSetup && !p.setupComplete && index >= 0)
      update((p) => ({ ...p, setupStep: index }));
    if (
      trackSetup &&
      !p.setupComplete &&
      next === "preview" &&
      !validateProject(p).errors.length
    )
      update((p) => ({ ...p, setupComplete: true }));
    window.scrollTo({ top: 0, behavior: "instant" });
    requestAnimationFrame(() => main.current?.focus({ preventScroll: true }));
  };
  useEffect(() => {
    const onHash = () => {
      const next = resolvePage(window.location.hash.slice(1));
      if (next.startsWith("transfer=")) {
        setIncomingTransfer(window.location.hash);
        return;
      }
      if (validPages.includes(next as (typeof validPages)[number])) {
        setIncomingTransfer(null);
        setPage(next);
        setErrors([]);
      }
    };
    const onInstall = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPrompt);
    };
    const onUpdate = () => setUpdateReady(true);
    window.addEventListener("hashchange", onHash);
    window.addEventListener("beforeinstallprompt", onInstall);
    window.addEventListener("schoolcal:update-ready", onUpdate);
    return () => {
      window.removeEventListener("hashchange", onHash);
      window.removeEventListener("beforeinstallprompt", onInstall);
      window.removeEventListener("schoolcal:update-ready", onUpdate);
    };
  }, []);
  useEffect(() => {
    const media = window.matchMedia("(max-width: 780px)");
    const change = () => {
      setNarrow(media.matches);
      if (!media.matches) setMobileNav(false);
    };
    media.addEventListener("change", change);
    return () => media.removeEventListener("change", change);
  }, []);
  useEffect(() => {
    if (!mobileNav || !narrow) return;
    const previous = document.activeElement as HTMLElement;
    sidebar.current?.querySelector<HTMLButtonElement>(".close-nav")?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileNav(false);
        return;
      }
      if (event.key !== "Tab") return;
      const items = [
        ...(sidebar.current?.querySelectorAll<HTMLElement>(
          "button:not(:disabled), a[href]",
        ) ?? []),
      ];
      const first = items[0],
        last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      }
      if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      previous?.focus({ preventScroll: true });
    };
  }, [mobileNav, narrow]);
  const stepIndex = STEPS.findIndex((step) => step.id === page),
    step = STEPS[stepIndex] ?? EXTRA_PAGES.find((item) => item.id === page);
  const next = () => {
    let issues: string[] = [];
    if (page === "year") {
      const a = p.academicYear;
      if (!p.name.trim()) issues.push("Give your timetable a name.");
      if (!validDate(a.startDate) || !validDate(a.endDate))
        issues.push("Enter valid first and last school dates.");
      else if (
        a.endDate <= a.startDate ||
        daysBetween(a.startDate, a.endDate) > 1096
      )
        issues.push("The last day must follow the first, within three years.");
      if (!a.schoolWeekdays.length)
        issues.push("Choose at least one school day.");
      if (!validTimezone(a.timezone))
        issues.push("Choose a valid school time zone.");
    }
    if (page === "periods")
      issues = validateProject(p, false).errors.filter((e) =>
        /period|must end|label/.test(e),
      );
    if (page === "subjects" && !p.subjects.length)
      issues.push("Add at least one subject to start your timetable.");
    if (page === "timetable") {
      issues = validateProject(p).errors;
      if (!issues.length) update((p) => ({ ...p, setupComplete: true }));
    }
    if (issues.length) {
      setErrors(issues);
      return;
    }
    navigate(STEPS[Math.min(stepIndex + 1, STEPS.length - 1)].id);
  };
  const openTimetable = (project: TimetableProject | null) => {
    if (!project) return;
    setTimetablesOpen(false);
    navigate(
      project.setupComplete ? "timetable" : STEPS[project.setupStep].id,
      false,
    );
  };
  const showTimetables = () => {
    setMobileNav(false);
    setTimetablesOpen(true);
  };
  const loadSample = () => {
    const added = state.add(sampleProject());
    if (!added) return;
    openTimetable(added);
    notify("Sample timetable added. All dates and lessons are editable.");
  };
  const backup = () => {
    downloadFile(
      serializeProject(p),
      `${safeFilename(p.name)}-project.json`,
      "application/json",
    );
    notify("Project backup downloaded.");
  };
  const importBackup = async (file?: File) => {
    if (!file) return;
    try {
      if (file.size > 2_000_000)
        throw new Error("Choose a project backup smaller than 2 MB.");
      const imported = parseProject(await file.text());
      if (
        !window.confirm(
          `Add “${imported.name || "Untitled timetable"}” as a timetable? Your saved timetables will be kept.`,
        )
      )
        return;
      const added = state.add(imported);
      if (!added) return;
      openTimetable(added);
      notify("Timetable added from backup.");
    } catch (error) {
      setErrors([
        error instanceof Error
          ? error.message
          : "This backup could not be read.",
      ]);
    } finally {
      if (fileInput.current) fileInput.current.value = "";
    }
  };
  const restartAfterRecovery = () => {
    if (
      window.confirm(
        "Start again with an empty timetable? Download the saved data first if you need to recover it.",
      )
    )
      openTimetable(state.restart());
  };
  const isSetup = !p.setupComplete;
  const dismissTransfer = (destination = page) => {
    setIncomingTransfer(null);
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${window.location.search}#${destination}`,
    );
  };
  const title = page === "timetable" && p.setupComplete ? p.name : step?.title;
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Skip to main content
      </a>
      {mobileNav && (
        <button
          className="nav-scrim"
          onClick={() => setMobileNav(false)}
          aria-label="Close navigation"
        />
      )}
      <aside
        ref={sidebar}
        id="sidebar"
        className={`sidebar ${mobileNav ? "open" : ""}`}
        inert={narrow && !mobileNav}
        role={narrow && mobileNav ? "dialog" : undefined}
        aria-modal={narrow && mobileNav ? true : undefined}
        aria-label="Main navigation"
      >
        <a
          href="#timetable"
          className="brand"
          onClick={(e) => {
            e.preventDefault();
            navigate(p.setupComplete ? "timetable" : "year");
          }}
        >
          <span className="brand-mark">
            <svg
              viewBox="0 0 128 128"
              width="35"
              height="35"
              aria-hidden="true"
            >
              <g
                fill="none"
                stroke="currentColor"
                strokeWidth="7"
                strokeLinejoin="round"
              >
                <rect x="31" y="31" width="66" height="66" rx="9" />
                <path d="M31 54h66M54 54v43" />
              </g>
              <rect
                x="65"
                y="65"
                width="21"
                height="20"
                rx="4"
                fill="currentColor"
                fillOpacity=".5"
              />
            </svg>
          </span>
          {BRAND.name}
        </a>
        <button
          className="close-nav icon-button"
          onClick={() => setMobileNav(false)}
          aria-label="Close navigation"
        >
          <X size={20} />
        </button>
        <button
          className="project-label"
          onClick={showTimetables}
          aria-label={`Switch timetable: ${p.name || "Untitled timetable"}`}
          aria-haspopup="dialog"
        >
          <span className="project-avatar" aria-hidden="true">
            <BookOpen size={18} />
          </span>
          <span className="project-name">
            <strong>{p.name || "Untitled timetable"}</strong>
            <small>Active · {state.timetables.length} saved</small>
          </span>
          <ChevronsUpDown size={16} aria-hidden="true" />
        </button>
        {isSetup ? (
          <nav className="setup-nav">
            <span className="nav-heading">LET’S GET YOU SET UP</span>
            {STEPS.map((item, i) => (
              <button
                key={item.id}
                className={`nav-item ${page === item.id ? "active" : ""}`}
                aria-current={page === item.id ? "step" : undefined}
                onClick={() => navigate(item.id)}
              >
                <span
                  className={`step-number ${i < stepIndex ? "complete" : ""}`}
                >
                  {i < stepIndex ? (
                    <Check size={13} />
                  ) : (
                    String(i + 1).padStart(2, "0")
                  )}
                </span>
                <span>{item.name}</span>
                {page === item.id && <ChevronRight size={15} />}
              </button>
            ))}
            <span className="nav-heading settings-heading">KEEP A COPY</span>
            <button
              className={`nav-item ${page === "export" ? "active" : ""}`}
              aria-current={page === "export" ? "page" : undefined}
              onClick={() => navigate("export")}
            >
              <Share2 size={18} />
              <span>Export &amp; share</span>
            </button>
          </nav>
        ) : (
          <nav>
            <span className="nav-heading">YOUR TIMETABLE</span>
            {[
              { id: "timetable", name: "My timetable", icon: Grid2X2 },
              STEPS[6],
              ...EXTRA_PAGES,
            ].map((item) => (
              <button
                className={`nav-item ${page === item.id ? "active" : ""}`}
                aria-current={page === item.id ? "page" : undefined}
                key={item.id}
                onClick={() => navigate(item.id)}
              >
                <item.icon size={18} />
                <span>{item.name}</span>
              </button>
            ))}
            <span className="nav-heading settings-heading">SETTINGS</span>
            {STEPS.slice(0, 5).map((item) => (
              <button
                className={`nav-item ${page === item.id ? "active" : ""}`}
                aria-current={page === item.id ? "page" : undefined}
                key={item.id}
                onClick={() => navigate(item.id)}
              >
                <item.icon size={18} />
                <span>{item.name}</span>
              </button>
            ))}
          </nav>
        )}
        <div className="sidebar-bottom">
          <div className="private-card">
            <span>
              <ShieldCheck size={18} />
              <strong>Just yours.</strong>
            </span>
            <p>
              Saved on this device.
              <br />
              No accounts. No uploads.
            </p>
          </div>
          <div className="sidebar-utility">
            <button onClick={() => setHelp(true)}>
              <HelpCircle size={15} />
              Help & privacy
            </button>
            <button
              aria-label="New timetable"
              title="New timetable"
              onClick={() => openTimetable(state.add())}
            >
              <Plus size={18} />
            </button>
          </div>
        </div>
      </aside>
      <div className="main-shell" inert={narrow && mobileNav}>
        <header className="topbar">
          <div>
            <button
              className="mobile-menu icon-button"
              aria-label="Open navigation"
              aria-expanded={mobileNav}
              aria-controls="sidebar"
              onClick={() => setMobileNav(true)}
            >
              <Menu size={22} />
            </button>
            <button
              className="mobile-timetable-switch"
              onClick={showTimetables}
              aria-haspopup="dialog"
              aria-label={`Switch timetable: ${p.name || "Untitled timetable"}`}
            >
              <span>{p.name || "Untitled timetable"}</span>
              <ChevronsUpDown size={15} aria-hidden="true" />
            </button>
            <span className="breadcrumb">
              {isSetup ? "New timetable" : "My workspace"}
              <ChevronRight size={14} />
              <strong>
                {page === "print" ? "Print timetable" : step?.name}
              </strong>
            </span>
          </div>
          <div className="topbar-actions">
            <div
              className={`save-status ${state.saveState === "error" ? "error" : ""}`}
              role="status"
            >
              {state.saveState === "saved" ? (
                <CheckCircle2 size={14} />
              ) : (
                <span className="status-dot" />
              )}
              <span>
                {state.recoveryError
                  ? "Recovery needed"
                  : state.saveState === "saved"
                    ? "Saved on this device"
                    : state.saveState === "error"
                      ? "Could not save"
                      : "Saving…"}
              </span>
            </div>
            <ThemeControl />
          </div>
        </header>
        <main id="main" ref={main} tabIndex={-1}>
          <div className="page-heading">
            <div>
              <h1>{title}</h1>
              <p>{step?.subtitle}</p>
            </div>
            {page === "timetable" && (
              <div className="page-actions">
                <button
                  className="button secondary"
                  onClick={() => navigate("print")}
                >
                  <Printer size={16} />
                  Print timetable
                </button>
                <button
                  className="button primary"
                  onClick={() => navigate("export")}
                >
                  <Download size={16} />
                  Export &amp; share
                </button>
              </div>
            )}
          </div>
          {isSetup && stepIndex >= 0 && (
            <div
              className="setup-progress"
              role="progressbar"
              aria-label="Timetable setup"
              aria-valuemin={0}
              aria-valuemax={7}
              aria-valuenow={stepIndex + 1}
            >
              {STEPS.map((s, i) => (
                <span key={s.id} className={i <= stepIndex ? "done" : ""} />
              ))}
            </div>
          )}
          {state.recoveryError && (
            <Notice kind="error">
              <strong>{state.recoveryError}</strong>
              <div className="notice-actions">
                {state.recoveryRaw && (
                  <button
                    className="button secondary"
                    onClick={() =>
                      downloadFile(
                        state.recoveryRaw!,
                        "schoolcal-recovery.json",
                        "application/json",
                      )
                    }
                  >
                    Download saved data
                  </button>
                )}
                <button
                  className="button secondary"
                  onClick={() => fileInput.current?.click()}
                >
                  Restore backup
                </button>
                <button
                  className="button secondary"
                  onClick={restartAfterRecovery}
                >
                  Start again
                </button>
              </div>
            </Notice>
          )}
          {state.saveState === "error" && (
            <Notice kind="error">
              {state.saveError}{" "}
              <button className="inline-link" onClick={backup}>
                download a project backup
              </button>{" "}
              to keep a copy.
            </Notice>
          )}
          {updateReady && (
            <Notice>
              A new version is ready.{" "}
              <button
                className="inline-link"
                disabled={state.saveState !== "saved" || !!state.recoveryError}
                onClick={() =>
                  window.dispatchEvent(new Event("schoolcal:apply-update"))
                }
              >
                Save and reload
              </button>
            </Notice>
          )}
          {errors.length > 0 && (
            <Notice kind="error">
              <ul>
                {errors.map((error) => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
            </Notice>
          )}
          <Fragment key={p.id}>
            {page === "year" && (
              <SchoolYear
                project={p}
                update={update}
                sample={loadSample}
                isNew={isSetup}
              />
            )}
            {page === "rotation" && <Rotation project={p} update={update} />}
            {page === "holidays" && <Holidays project={p} update={update} />}
            {page === "periods" && <Periods project={p} update={update} />}
            {page === "subjects" && <Subjects project={p} update={update} />}
            {page === "timetable" && (
              <Timetable
                project={p}
                update={update}
                editEntries={state.editEntries}
                undo={state.undo}
                canUndo={state.canUndo}
                notify={notify}
                navigate={navigate}
              />
            )}
            {page === "preview" && (
              <LessonPreview
                project={p}
                includeFixedPeriods={includeFixedPeriods}
                onIncludeFixedPeriodsChange={setIncludeFixedPeriods}
                notify={notify}
                navigate={navigate}
              />
            )}
            {page === "export" && (
              <ExportShare
                project={p}
                includeFixedPeriods={includeFixedPeriods}
                onIncludeFixedPeriodsChange={setIncludeFixedPeriods}
                notify={notify}
                navigate={navigate}
                onBackup={backup}
                onImport={() => fileInput.current?.click()}
              />
            )}
            {page === "print" && <PrintView project={p} />}
          </Fragment>
          {isSetup && stepIndex >= 0 && stepIndex < 6 && (
            <footer className="setup-footer">
              <button
                className="button text-button"
                disabled={stepIndex === 0}
                onClick={() => navigate(STEPS[stepIndex - 1].id)}
              >
                <ArrowLeft size={16} />
                Back
              </button>
              <span>You can change these details anytime.</span>
              <button className="button primary" onClick={next}>
                {page === "timetable" ? "Finish & preview lessons" : "Continue"}
                <ArrowRight size={17} />
              </button>
            </footer>
          )}
          {!isSetup && stepIndex >= 0 && stepIndex < 5 && (
            <div className="settings-footer">
              <button
                className="button primary"
                onClick={() => navigate("timetable")}
              >
                Back to timetable
                <ArrowRight size={16} />
              </button>
            </div>
          )}
          <footer className="app-footer">
            <button
              onClick={() => {
                if (installPrompt)
                  void installPrompt
                    .prompt()
                    .then(() => setInstallPrompt(null));
                else setInstallHelp(true);
              }}
            >
              <Download size={13} />
              Install app
            </button>
          </footer>
        </main>
      </div>
      <input
        ref={fileInput}
        className="sr-only"
        tabIndex={-1}
        type="file"
        accept=".json,application/json"
        aria-label="Import project file"
        onChange={(e) => void importBackup(e.target.files?.[0])}
      />
      <div
        className={`toast ${toast ? "visible" : ""}`}
        role="status"
        aria-live="polite"
      >
        {toast && (
          <>
            <CheckCircle2 size={17} />
            {toast}
          </>
        )}
      </div>
      {incomingTransfer && (
        <TransferImport
          key={incomingTransfer}
          hash={incomingTransfer}
          hasCurrent={
            !!(
              p.name ||
              p.subjects.length ||
              p.entries.length ||
              p.periods.length ||
              p.academicYear.startDate ||
              state.recoveryError
            )
          }
          onBackup={() => {
            if (state.recoveryRaw && state.recoveryError)
              downloadFile(
                state.recoveryRaw,
                "schoolcal-recovery.json",
                "application/json",
              );
            else backup();
          }}
          saveError={state.saveError}
          onClose={() => dismissTransfer()}
          onImport={(imported) => {
            const destination = imported.setupComplete
              ? "timetable"
              : STEPS[imported.setupStep].id;
            const added = state.add(imported);
            if (!added) return;
            setPage(destination);
            setErrors([]);
            setMobileNav(false);
            dismissTransfer(destination);
            notify(
              "Timetable received. You can continue editing on this device.",
            );
          }}
        />
      )}
      {timetablesOpen && (
        <TimetableSwitcher
          timetables={state.timetables}
          activeId={p.id}
          error={state.saveError || state.recoveryError || ""}
          onClose={() => setTimetablesOpen(false)}
          onSelect={(id) => openTimetable(state.select(id))}
          onCreate={() => openTimetable(state.add())}
          onRename={(id, name) => !!state.rename(id, name)}
          onDuplicate={(id) => openTimetable(state.duplicate(id))}
          onDelete={(id) => {
            const selected = state.remove(id);
            if (selected && id === p.id) openTimetable(selected);
          }}
        />
      )}
      {help && (
        <Modal title="A little help" onClose={() => setHelp(false)}>
          <div className="help-content">
            <h3>Fill your timetable quickly</h3>
            <p>
              Choose a subject in the palette, then click or tap every cell it
              belongs in. Switch to Select to edit a lesson's teacher, room,
              title, or notes.
            </p>
            <h3>Handy shortcuts</h3>
            <p>
              Copy: Ctrl/⌘ C · Paste: Ctrl/⌘ V · Undo: Ctrl/⌘ Z<br />
              Clear: Delete or Backspace · Stop painting: Escape
              <br />
              Move between cells with the arrow keys.
            </p>
            <h3>Holidays and rotation</h3>
            <p>
              Only teaching weeks count. A full week off pauses your rotation.
              Reset holidays restart it at the first week. If a short break
              falls inside a week already underway, that week finishes normally;
              the next teaching week resets.
            </p>
            <h3>Your privacy</h3>
            <p>
              Your timetable is stored on this device. {BRAND.name} does not
              upload or collect your timetable data. There are no accounts,
              analytics, or adverts. Clearing browser storage removes your saved
              project; a JSON backup lets you restore it.
            </p>
            <h3>Keep a backup</h3>
            <p>
              Open “Export & share” to download an editable JSON backup, import
              a backup, create a QR code for another device, or download an .ics
              file for your calendar app. Transfers and calendar imports are
              copies and don't update automatically.
            </p>
            <button
              className="button secondary"
              onClick={() => {
                setHelp(false);
                navigate("export");
              }}
            >
              <Share2 size={16} />
              Export &amp; share
            </button>
          </div>
        </Modal>
      )}
      {installHelp && (
        <Modal
          title={`Keep ${BRAND.name} close by`}
          onClose={() => setInstallHelp(false)}
        >
          <p>
            Install the app to open it from your home screen and use it offline
            after the first visit.
          </p>
          <h3>On iPhone or iPad</h3>
          <p>Open this site in Safari, tap Share, then Add to Home Screen.</p>
          <h3>On Android or a computer</h3>
          <p>
            Use your browser's “Install app” or “Add to Home screen” option.
            Installation requires a secure (HTTPS) connection.
          </p>
        </Modal>
      )}
    </div>
  );
}
