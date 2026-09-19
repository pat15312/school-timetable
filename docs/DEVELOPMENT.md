# SchoolCal development guide

[Overview](../README.md) · [User guide](USER_GUIDE.md) · [Release history](../CHANGELOG.md)

## Run locally and test

Run these commands from the repository root.

Use **Node.js 22.12+** (or Node.js 24) and npm.

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite. New users start with an empty project. **Try a sample** explicitly loads the optional 2026–27 fixture; it is never loaded automatically.

```sh
npm run typecheck
npm test
npx playwright install --with-deps chromium webkit
npm run test:e2e
npm run build
npm run preview
```

Playwright builds and tests the **production** site, including its service worker, with desktop and iPhone-sized Chromium contexts. The full journey checks setup, half-term continuation, Christmas reset, painting, overrides, undo, week duplication, JSON backups, calendar downloads, corrupt-storage recovery, and offline access. Desktop tests also generate real PDFs, check their page counts, and verify that the last row fits on each page. Axe checks the main screens for WCAG A/AA violations. Unit tests independently parse exported calendars with `ical.js`, including timezone transitions. `ical.js` and Axe are only development dependencies.

Layout checks also run in desktop and mobile WebKit, covering date/time field sizing, sticky navigation, and subject selection outlines across phone, tablet, and desktop widths.

Subject duplication and reordering are tested in both browsers, including independent teacher/room defaults, saved order, calendar exports, and responsive controls in light and dark themes.

Period checks cover existing Registration assignments, renamed tutor periods, extra breaks, creation/editing/deletion of fixed periods, invalid times, print rows, and optional calendar inclusion in both browsers.

Category checks cover creating and renaming dropdown choices, switching subjects on and off across all assigned periods, restoring saved lessons, replacing used categories before deletion, version 1 upgrades, version 2 backups, and mobile/desktop accessibility.

Timetable collection checks cover legacy migration, active selection and setup progress, independent copies and calendar UIDs, confirmed deletion, additive JSON/link imports, failed saves, mobile/light/dark accessibility, active exports in Chromium and WebKit, plus offline reopening in Chromium.

To exercise date handling in a different host timezone:

```sh
TZ=America/Los_Angeles npm test
```

Sharing checks use mocked browser APIs to verify that shared files match downloads, export options apply, blocked sharing offers a download, cancellation stays quiet, and unavailable APIs do not break export. These checks also run in desktop and mobile WebKit.

## Architecture

- React + TypeScript + Vite; plain CSS and Lucide icons.
- Pure domain utilities in `src/domain/`: civil dates, teaching weeks, validation, occurrences, iCalendar output, editing operations, print preparation, and versioned persistence.
- React views in `src/components/`; the project and editing history are managed by `src/hooks/useProject.ts`.
- Zod validates **untrusted JSON and saved-state structure**. Domain validation separately checks whether a project is ready for export, so an incomplete draft can still be saved.
- A local timetable collection under `schoolcal.timetables.v1`, migrated automatically from the earlier `schoolcal.project.v1` single project. Version 2 timetable backups include editable period categories. Version 1 projects and backups upgrade automatically: fixed types become categories, and legacy Other periods move to Lesson with their names, IDs, subjects and overrides preserved. Unknown schemas and damaged backups are rejected before changing a project. Unreadable saved data can be downloaded for recovery.
- Hash navigation works without server-side route rewriting. Changing rotation length or school days preserves entries in hidden weeks/days.
- `src/brand.ts` holds the name, default colour and calendar product identifier; theme tokens live in `src/styles.css`. Keep the sidebar SVG in `src/App.tsx`, the dynamic favicon in `public/theme.js`, and `public/favicon.svg` consistent when changing the logo. Regenerate committed PNG icons with `node scripts/generate-icons.mjs` (requires Playwright's Chromium browser).

There is no backend, database, authentication, API key, account, tracking, analytics, advertising, or remote font dependency.

## Appearance and branding

The header's appearance button offers **Dark**, **Light**, and **Auto**. Auto follows device settings and is the default. An explicit choice is saved locally under `schoolcal.theme`, stays in sync across tabs, and is applied before the app renders. Appearance still works when browser storage is unavailable. The same menu includes **App colour**: choose one colour and matching light/dark shades are generated with readable contrast. The on-screen logo and browser icon follow the choice. Colour is saved separately under `schoolcal.colour`, syncs across tabs, and can be reset to blue. Desktop pages reserve scrollbar space so short and long pages stay aligned. Timetable print previews and PDFs use white paper, black/grey text and rules, and narrow subject-colour markers without coloured cell fills.

The palette generator lives in `public/colours.js`; `public/theme.js` applies preferences before React loads.

## Persistence and backup compatibility

The app version and backup schema version are independent. **App version 1.0.0 uses backup schema version 2.** The collection is stored under `schoolcal.timetables.v1`, with all timetables, the active ID and per-timetable preview/export preferences in one atomic write. The old `schoolcal.project.v1` key is read only when no collection exists and is retained untouched after migration. JSON backups contain a `schemaVersion` and a `timetable` object; the importer accepts schemas 1 and 2.

Zod checks the shape before references and duplicate IDs/cells are checked. Imports are validated before adding a timetable. Matching project IDs receive a fresh identity on the receiving device; otherwise their calendar identity is retained. Duplication always creates a new identity and deep-copies nested data. Appearance preferences and the fixed-period display choice are stored separately from the timetable backup. Saves happen inside edits. Switching, adding, renaming, duplicating and deleting only commit in memory after successful storage writes. Switching remounts timetable-specific views and clears undo history. Unreadable data blocks autosaving; explicit recovery retains a damaged collection under `schoolcal.timetables.recovery`.

## Spreadsheets and app updates

The version 1 workbook format is defined in `src/domain/spreadsheet.ts` and documented in the [user guide](USER_GUIDE.md#edit-in-excel-or-google-sheets). ExcelJS runs in a dedicated worker that Vite bundles locally and Workbox precaches. Processing ends on cancel, navigation, switching or a 30-second timeout. A ZIP preflight limits declared expansion to 20 MB and 500 members before parsing; workbook limits bound rows, columns and sheets. Formula cells are rejected, and exports use literal strings. Cell-level validation precedes the same structural/reference validation used for JSON backups. Readiness errors become draft warnings, while malformed populated fields block import. Imports always create a new project identity and commit through the existing additive library operation.

Spreadsheet tests cover actual XLSX round trips, draft progress, hidden slots, custom categories, explicit empty overrides, native Excel date/time cells in two host time zones, malformed files and bounded parsing. Browser tests exercise active exports, template downloads, preview/cancel/add, failed saves, light/dark accessibility and reloads in Chromium and WebKit; Chromium also tests offline import/export. ExcelJS's transitive `uuid` is pinned to 11.1.1 via an override to avoid its older vulnerable dependency; ExcelJS uses its compatible `v4` API.

`src/lib/appUpdate.ts` tracks update availability independently of component mount timing. An explicit Save and reload first persists the current library, requests activation, then listens for the native service-worker controller change rather than relying on Workbox's `isUpdate` flag. It checks saving again before reload, handles an update already activated in another tab, and offers retry after a failed or timed-out activation. Other tabs are not forcibly reloaded. Production browser tests serve two revisions from an isolated local origin to exercise real precaching, waiting workers, reload, saved data and offline reopening.

## Rotation and calendar details

The [user guide](USER_GUIDE.md#how-week-rotation-works) explains teaching weeks and partial-week resets. Internally, rotation indexes are zero based and independent of labels; all views use `getRotationLabel()`. Weekday indexes follow JavaScript's convention: Sunday `0` through Saturday `6`. Reset exclusions are processed in end-date order; overlapping exclusions act as a union.

The exporter writes individual `VEVENT`s—**no `RRULE`**. Excluded dates, disabled days, and empty cells produce no lesson events. **Include fixed periods** optionally exports periods whose categories have Allow subjects switched off, using each period's name and times.

- Stable, collision-free UIDs derive from the project, date, weekday, period, and subject IDs.
- Text escapes commas, semicolons, backslashes, and line breaks; physical lines fold at 75 UTF-8 bytes with CRLF endings.
- School dates stay ISO **civil dates**, separate from times. UTC is used only as an internal arithmetic carrier for day addition, never to interpret user-entered school dates as instants.
- Lesson `DTSTART`/`DTEND` use the school's IANA `TZID`. A self-contained `VTIMEZONE` contains explicit transitions across the academic year and an extra year on either side, using the browser's timezone data. There are no timezone recurrence rules either.
- A London lesson entered as 09:00 stays at 09:00 through BST/GMT changes. The school's detected timezone can be edited in School year & rotation.
- Lesson preview defaults to the first unfinished teaching week, or the last week once the year is over. Manual week/date selection overrides that default until the page is left or reloaded. Preview selection and year progress share a clock that refreshes every 30 seconds and on focus/visibility changes. Progress counts ended subject lessons and teaching weeks whose final school day has passed its last period, using school-local time. Export & share holds validation links, calendar export, JSON backups/import and device transfer. Preview and export share the fixed-period choice in app state, but fixed periods never increase lesson totals. Legacy `#review` and `#overview` routes open the preview, and saved setup-step indices remain compatible.
- QR generation uses the locally bundled `qrcode` encoder, loaded on demand and cached by the PWA. It encodes the current app URL (without its query string) and compressed transfer fragment in byte mode with medium error correction and a four-module white margin. Links above 2,331 UTF-8 bytes fall back to copy-link or JSON backup; encoding never drops timetable fields. The browser tests independently decode the generated image with `jsQR` and compare the received configuration with the full fixture.

See [RFC 5545](https://www.rfc-editor.org/rfc/rfc5545) for the calendar format.

Imports are snapshots and stable UIDs do not guarantee deduplication by every calendar app. See the [import guidance](USER_GUIDE.md#export-and-share-your-calendar).

## GitHub Pages deployment

The service worker caches the application shell and static assets only. Assets are served from the same origin, and hash navigation stays within the browser. The app does not upload timetable data; user-requested sharing passes a generated file to the selected app. Hosting access logs can record ordinary asset requests. Installation requires HTTPS or localhost. Clearing site data may remove both the saved project and the offline cache.

The [Pages workflow](../.github/workflows/pages.yml) runs on pushes and pull requests to `main`, and supports manual dispatch. It installs locked dependencies, type-checks, runs unit tests in two timezones, builds and tests the production app with Playwright, uploads `dist`, and deploys after successful checks. Pull requests test without deploying.

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

## Scope and limitations

- Multiple timetables per browser/origin, subject to browser storage limits; no cloud sync. Saves check for changes made by another tab and block stale writes. Use one editing tab and keep a JSON backup of each timetable.
- Supports modern browsers, same-day periods, and one shared period structure across enabled school days. Overnight lessons and different bell schedules per weekday are outside this release.
- Bounds keep malformed imports and accidental huge calendars manageable: dates from 1900–2200, up to three years per project, 40 periods, 40 period categories, 100 subjects, 200 exclusions, and 2 MB backups. Normal school years are much smaller.
- Sample holidays are illustrative and must be checked against the actual school calendar. They are not a source of official term dates.
- Browser timezone rules depend on its installed IANA data. Use a current browser. Rare ambiguous/nonexistent lesson times during the overnight clock change follow calendar-client timezone interpretation.
- Automated phone testing uses Chromium and WebKit with iPhone viewports, not a physical iPhone or native Apple Calendar/Outlook. Actual calendar-client import and physical-printer output still need release-device checks.
- No homework, grades, messaging, notifications, exams, subscriptions, or OCR.

## Releases

Keep `package.json`, the root package entries in `package-lock.json`, and [CHANGELOG.md](../CHANGELOG.md) aligned with the app version. Backup schemas are versioned independently.

For a release, commit the changes, confirm the deployment workflow passes for that commit, create and push an annotated `vX.Y.Z` tag pointing to it, then publish a GitHub Release with user-facing notes and the live app link. GitHub provides source archives from the tag; using the hosted app does not require downloading source code.
