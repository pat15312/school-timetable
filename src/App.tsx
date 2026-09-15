import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CalendarCheck2,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
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
  Upload,
  X,
} from "lucide-react";
import { BRAND } from "./brand";
import { createProject } from "./domain/model";
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
import { Review } from "./components/Review";
import { PrintView } from "./components/PrintView";
import { Modal, Notice, downloadFile } from "./components/ui";

const STEPS = [
  {
    id: "year",
    name: "School year",
    icon: CalendarDays,
    title: "Let’s start with your school year.",
    subtitle: "A few details now. A simpler school year ahead.",
  },
  {
    id: "rotation",
    name: "Timetable rotation",
    icon: RotateCcw,
    title: "Every week has a rhythm.",
    subtitle: "Set the pattern your school follows.",
  },
  {
    id: "holidays",
    name: "Holidays & days off",
    icon: Leaf,
    title: "Make room for the days off.",
    subtitle: "Holidays, inset days, and a well-earned break.",
  },
  {
    id: "periods",
    name: "Lesson times",
    icon: Clock3,
    title: "A school day, your way.",
    subtitle: "Build the daily structure for your timetable.",
  },
  {
    id: "subjects",
    name: "Subjects",
    icon: BookOpen,
    title: "Bring your subjects together.",
    subtitle: "One little library. Every lesson covered.",
  },
  {
    id: "timetable",
    name: "Build timetable",
    icon: Grid2X2,
    title: "Your week, taking shape.",
    subtitle: "Pick a subject. Place it in your week. Make it yours.",
  },
  {
    id: "review",
    name: "Review & export",
    icon: CalendarCheck2,
    title: "Your school year, sorted.",
    subtitle: "Check the details, then take your timetable with you.",
  },
] as const;
const validPages = [...STEPS.map((step) => step.id), "print"];
type InstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
};

export default function App() {
  const state = useProject(),
    { project: p, update, replace } = state;
  const [page, setPage] = useState<string>(() => {
    const hash = window.location.hash.slice(1);
    return validPages.includes(hash as (typeof validPages)[number])
      ? hash
      : p.setupComplete
        ? "timetable"
        : STEPS[p.setupStep].id;
  });
  const [mobileNav, setMobileNav] = useState(false);
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
  const navigate = (next: string) => {
    if (!validPages.includes(next as (typeof validPages)[number])) return;
    setPage(next);
    setErrors([]);
    setMobileNav(false);
    window.location.hash = next;
    const index = STEPS.findIndex((step) => step.id === next);
    if (!p.setupComplete && index >= 0)
      update((p) => ({ ...p, setupStep: index }));
    if (
      !p.setupComplete &&
      ["review", "print"].includes(next) &&
      !validateProject(p).errors.length
    ) update((p) => ({ ...p, setupComplete: true }));
    window.scrollTo({ top: 0, behavior: "instant" });
    requestAnimationFrame(() => main.current?.focus({ preventScroll: true }));
  };
  useEffect(() => {
    const onHash = () => {
      const next = window.location.hash.slice(1);
      if (validPages.includes(next as (typeof validPages)[number])) {
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
    step = STEPS[stepIndex];
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
  const loadSample = () => {
    if (
      (p.name || p.entries.length) &&
      !window.confirm(
        "Replace this timetable with the sample? Back up your current project first if you want to keep it.",
      )
    )
      return;
    replace(sampleProject());
    navigate("timetable");
    notify("Sample timetable loaded. All dates and lessons are editable.");
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
          `Restore “${imported.name || "Untitled timetable"}”? This replaces the timetable on this device.`,
        )
      )
        return;
      replace(imported);
      navigate(
        imported.setupComplete ? "timetable" : STEPS[imported.setupStep].id,
      );
      notify("Project restored.");
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
  const deleteProject = () => {
    if (
      window.confirm(
        "Delete this timetable and start again? Download a project backup first if you want to keep it.",
      )
    ) {
      replace(createProject());
      navigate("year");
      notify("Ready for a new timetable.");
    }
  };
  const isSetup = !p.setupComplete;
  const title =
    page === "print"
      ? "A timetable worth pinning up."
      : page === "timetable" && p.setupComplete
        ? p.name
        : step?.title;
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
            <Grid2X2 size={23} strokeWidth={2.5} />
          </span>
          {BRAND.name}
          <span className="brand-dot">.</span>
        </a>
        <button
          className="close-nav icon-button"
          onClick={() => setMobileNav(false)}
          aria-label="Close navigation"
        >
          <X size={20} />
        </button>
        <div className="project-label">
          <span className="project-avatar">
            {p.name ? (
              p.name.trim().slice(0, 1).toUpperCase()
            ) : (
              <BookOpen size={18} />
            )}
          </span>
          <div>
            <strong>{p.name || "My school timetable"}</strong>
            <small>
              {p.academicYear.startDate && p.academicYear.endDate
                ? `${p.academicYear.startDate.slice(0, 4)} – ${p.academicYear.endDate.slice(0, 4)}`
                : "Let’s make it yours"}
            </small>
          </div>
        </div>
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
          </nav>
        ) : (
          <nav>
            <span className="nav-heading">YOUR TIMETABLE</span>
            {[
              { id: "timetable", name: "My timetable", icon: Grid2X2 },
              { id: "review", name: "Calendar & export", icon: CalendarCheck2 },
              { id: "print", name: "Print timetable", icon: Printer },
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
          <button className="nav-item subtle" onClick={backup}>
            <Download size={16} />
            <span>Back up project</span>
          </button>
          <button
            className="nav-item subtle"
            onClick={() => fileInput.current?.click()}
          >
            <Upload size={16} />
            <span>Import project</span>
          </button>
          <div className="sidebar-utility">
            <button onClick={() => setHelp(true)}>
              <HelpCircle size={15} />
              Help & privacy
            </button>
            <button
              aria-label="Start again"
              title="Start again"
              onClick={deleteProject}
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
            <span className="breadcrumb">
              {isSetup ? "New timetable" : "My workspace"}
              <ChevronRight size={14} />
              <strong>
                {page === "print" ? "Print timetable" : step?.name}
              </strong>
            </span>
          </div>
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
        </header>
        <main id="main" ref={main} tabIndex={-1}>
          <div className="page-heading">
            <div>
              <span className="eyebrow">
                {isSetup && stepIndex >= 0
                  ? `STEP ${String(stepIndex + 1).padStart(2, "0")} OF 07`
                  : page === "timetable"
                    ? "A LITTLE STRUCTURE. A LOT LESS STRESS."
                    : "YOUR SCHOOL YEAR, SIMPLIFIED"}
              </span>
              <h1>{title}</h1>
              <p>
                {page === "print"
                  ? "Make a copy for your wall, your folder, or wherever you need it."
                  : step?.subtitle}
              </p>
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
                  onClick={() => navigate("review")}
                >
                  <Download size={16} />
                  Export calendar
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
                <button className="button secondary" onClick={deleteProject}>
                  Start again
                </button>
              </div>
            </Notice>
          )}
          {state.saveState === "error" && (
            <Notice kind="error">
              Your browser could not save this timetable. Keep this page open
              and{" "}
              <button className="inline-link" onClick={backup}>
                download a project backup
              </button>{" "}
              before leaving.
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
          {page === "review" && <Review project={p} notify={notify} />}
          {page === "print" && <PrintView project={p} />}
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
                {page === "timetable" ? "Finish & review" : "Continue"}
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
            <span>
              {BRAND.name} <i>·</i> A calmer school week.
            </span>
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
              “Back up project” saves an editable JSON file. “Export Calendar”
              creates an .ics file for your calendar app. Calendar imports are
              snapshots and don't update automatically.
            </p>
            <button className="button secondary" onClick={backup}>
              <Download size={16} />
              Back up project
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
