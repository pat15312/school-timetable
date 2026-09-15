# SchoolCal

**The easiest way to put your school timetable into your calendar.**

A static, private timetable editor for students and parents. Build a one-to-four-week timetable, exclude school holidays, print a clean copy, and export every actual lesson as an individual `.ics` event.

## Run locally

Use **Node.js 22.12+** (or Node.js 24) and npm.

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite. New users start with an empty project. **Try a sample** explicitly loads the optional 2026–27 fixture; it is never loaded automatically.

```sh
npm run typecheck
npm test
npx playwright install --with-deps chromium
npm run test:e2e
npm run build
npm run preview
```

Playwright builds and tests the **production** site, including its service worker, with desktop and iPhone-sized Chromium contexts. The full journey checks setup, half-term continuation, Christmas reset, painting, overrides, undo, week duplication, JSON backups, calendar downloads, corrupt-storage recovery, and offline access. Desktop tests also generate real PDFs, check their page counts, and verify that the last row fits on each page. Axe checks the main screens for WCAG A/AA violations. Unit tests independently parse exported calendars with `ical.js`, including timezone transitions. `ical.js` and Axe are only development dependencies.

To exercise date handling in a different host timezone:

```sh
TZ=America/Los_Angeles npm test
```

## Architecture

- React + TypeScript + Vite; plain CSS and Lucide icons.
- Pure domain utilities in `src/domain/`: civil dates, teaching weeks, validation, occurrences, iCalendar output, editing operations, print preparation, and versioned persistence.
- React views in `src/components/`; the project and editing history are managed by `src/hooks/useProject.ts`.
- Zod validates **untrusted JSON and saved-state structure**. Domain validation separately checks whether a project is ready for export, so an incomplete draft can still be saved.
- One local project, stored in `localStorage` under `schoolcal.project.v1`. Saves include a `schemaVersion` envelope. Unknown schemas and damaged backups are rejected before changing a project. Unreadable saved data can be downloaded for recovery.
- Hash navigation works without server-side route rewriting. Changing rotation length or school days preserves entries in hidden weeks/days.
- Branding is centralised in `src/brand.ts`; theme tokens are at the top of `src/styles.css`. The code-native favicon is in `public/favicon.svg`. After changing it, regenerate the committed PNG icons with `node scripts/generate-icons.mjs` (requires the Playwright browser).

There is no backend, database, authentication, API key, account, tracking, analytics, advertising, or remote font dependency.

## Appearance

The header's appearance button offers **Dark**, **Light**, and **Auto**, matching NetRevive. Auto follows device settings and is the default. An explicit choice is saved locally under `schoolcal.theme`, stays in sync across tabs, and is applied before the app renders. Appearance still works when browser storage is unavailable. The interface uses a blue palette; timetable print previews and PDFs always use light paper colours.

## Rotation rules

1. Weeks run **Monday–Sunday**. Weekday indexes follow JavaScript's convention: Sunday `0`, Monday `1`, … Saturday `6`.
2. A teaching week contains at least one enabled school day inside the academic year that is not excluded.
3. The first teaching week uses the selected starting rotation. A midweek start still counts as that week.
4. Each subsequent teaching week advances the rotation once. Full weeks without teaching days consume **no rotation week**.
5. A normal holiday continues the sequence: `Week 1 → holiday → Week 2`.
6. A reset holiday sets the first teaching week after the holiday to index `0` (`Week 1` / `Week A`). Multiple holidays are processed in date order; overlapping exclusions act as a union.

**Partial-week reset rule:** a week has one label throughout. A reset applies to the first week whose **first actual teaching day** is after the exclusion. If a short break interrupts a week already underway, finish that week's existing rotation, then reset the next teaching week. If a holiday ends midweek and there was no teaching earlier that week, the remaining days start the reset week. This avoids retroactively relabelling lessons before an inset day.

Rotation indexes are zero based and independent of labels. All views use `getRotationLabel()`.

## Editing

Select a subject in the palette and tap multiple cells to place it quickly. Defaults for teacher and room remain linked to the subject. Switch to **Select**, choose a lesson, and use **Edit lesson** for explicit title, teacher, room, or note overrides. Uncheck an override to return to the subject default; an explicitly empty teacher/room suppresses that default.

- Ctrl/⌘ C: copy selected entry
- Ctrl/⌘ V: paste into selected cell (including another rotation week)
- Delete / Backspace: clear the selected entry
- Ctrl/⌘ Z: undo an entry edit or week duplication
- Escape: stop painting / clear selection
- Arrow keys: move through editable grid cells

Visible buttons provide the same actions for touch. Undo keeps the last 80 entry edits in memory and resets when a project is replaced or the page is reloaded. Week replacement requires an explicit confirmation in the copy dialog.

On phones, the timetable becomes a day list with weekday tabs and a sticky, horizontally scrollable subject palette. Break and lunch are structural rows, and registration/other periods can optionally contain lessons.

## Calendar output

The exporter writes individual `VEVENT`s—**no `RRULE`**. Excluded dates, disabled days, and empty cells produce no lesson events. Break/lunch export is opt-in.

- Stable, collision-free UIDs derive from the project, date, weekday, period, and subject IDs.
- Text escapes commas, semicolons, backslashes, and line breaks; physical lines fold at 75 UTF-8 bytes with CRLF endings.
- School dates stay ISO **civil dates**, separate from times. UTC is used only as an internal arithmetic carrier for day addition, never to interpret user-entered school dates as instants.
- Lesson `DTSTART`/`DTEND` use the school's IANA `TZID`. A self-contained `VTIMEZONE` contains explicit transitions across the academic year and an extra year on either side, using the browser's timezone data. There are no timezone recurrence rules either.
- A London lesson entered as 09:00 stays at 09:00 through BST/GMT changes. The school's detected timezone can be edited in School year.
- Export validates before creating the file. The preview shows totals, first/last lessons, and any selected teaching week.

See [RFC 5545](https://www.rfc-editor.org/rfc/rfc5545) for the calendar format.

Open `.ics` files with Apple Calendar or Outlook, or use Google Calendar's desktop **Settings → Import & export**. Where file sharing is supported, **Share Calendar** uses the Web Share API.

Calendar imports are snapshots. Stable UIDs do **not** guarantee that every calendar app deduplicates repeated imports. Use a dedicated school calendar and remove the previous import before replacing it. There is no hosted subscription or direct calendar API integration.

## Printing

**Print timetable** opens a dedicated preview, separate from the editor:

- **One week per page:** A4 landscape.
- **Two weeks per page:** A4 portrait, with a final unpaired week for a three-week cycle.

Browser-native print CSS supplies paper orientation, margins, fixed page boundaries, subject labels, times, room/teacher details, and structural rows. Controls and navigation are excluded. Borders and text keep the timetable understandable in greyscale. Unusually long school days scale to fit without dropping rows; landscape offers more room for readable text. Select A4 and disable the browser's headers/footers; choose **Save as PDF** for a digital copy.

## Privacy, persistence, and offline use

The app never sends timetable data over the network. All application assets are served from the same origin. As with any static website, the hosting provider can receive ordinary HTTP access logs for asset requests; those requests contain no timetable data. Hash navigation stays in the browser.

The PWA caches only the application shell and static assets. A visited installation works offline after its first successful cache. Updates prompt before reloading. Installation needs HTTPS (or localhost); on iPhone use Safari → Share → Add to Home Screen.

Browser storage belongs to the current browser/profile and origin. Clearing website data, changing hosting URL, or using a different device does not preserve a project. Private browsing or quota restrictions may prevent saving; the app shows an error and offers a backup. Keep a **Back up project (.json)** file for recovery or manual transfer; **Import project** validates and confirms replacement.

## GitHub Pages deployment

The supplied `.github/workflows/pages.yml` runs on pushes and pull requests to `main`, and supports manual dispatch. It installs locked dependencies, type-checks, runs unit tests in two timezones, builds and tests the production app with Playwright, uploads `dist`, and deploys after successful checks. Pull requests test without deploying.

1. Create or select a GitHub repository, add these files, and push to `main` (change the workflow branch if necessary).
2. In **Repository Settings → Pages → Build and deployment**, choose **GitHub Actions** as the source.
3. Ensure repository Actions are enabled and the `github-pages` environment permits the branch to deploy.
4. Run the workflow or push to `main`. Its deployment job reports the Pages URL.

The workflow sets Vite's `BASE_PATH` to `/<repository-name>/`, automatically using `/` for a `*.github.io` repository. For a custom domain served at its root, set the repository Actions variable `BASE_PATH` to `/`. JavaScript, icons, the manifest, and service-worker scope all follow this base.

Test a repository-subdirectory build locally:

```sh
BASE_PATH=/school-timetable/ npm run build
BASE_PATH=/school-timetable/ npm run test:e2e
```

See [Vite's GitHub Pages deployment guide](https://vite.dev/guide/static-deploy.html#github-pages). A GitHub remote and Pages settings must exist before an actual deployment; generating this project does not create a remote repository.

## Scope and limitations

- One project per browser/origin; no cloud sync or coordination between multiple open editing tabs. Use one editing tab and keep backups.
- Supports modern browsers, same-day periods, and one shared period structure across enabled school days. Overnight lessons and different bell schedules per weekday are outside this release.
- Bounds keep malformed imports and accidental huge calendars manageable: dates from 1900–2200, up to three years per project, 40 periods, 100 subjects, 200 exclusions, and 2 MB backups. Normal school years are much smaller.
- Sample holidays are illustrative and must be checked against the actual school calendar. They are not a source of official term dates.
- Browser timezone rules depend on its installed IANA data. Use a current browser. Rare ambiguous/nonexistent lesson times during the overnight clock change follow calendar-client timezone interpretation.
- Automated phone testing uses Chromium with an iPhone viewport, not a physical iPhone or native Apple Calendar/Outlook. Actual calendar-client import and physical-printer output still need release-device checks.
- No homework, grades, messaging, notifications, exams, subscriptions, or OCR. A future image/photo/PDF importer can populate the same subject, period, exclusion, and entry structures, then hand off to the existing editor for correction; it is intentionally not implemented here.
