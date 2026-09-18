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
- One local project, stored in `localStorage` under `schoolcal.project.v1`. Version 2 saves include editable period categories. Version 1 projects and backups upgrade automatically: fixed types become categories, and legacy Other periods move to Lesson with their names, IDs, subjects and overrides preserved. Unknown schemas and damaged backups are rejected before changing a project. Unreadable saved data can be downloaded for recovery.
- Hash navigation works without server-side route rewriting. Changing rotation length or school days preserves entries in hidden weeks/days.
- `src/brand.ts` holds the name, default colour and calendar product identifier; theme tokens live in `src/styles.css`. Keep the sidebar SVG in `src/App.tsx`, the dynamic favicon in `public/theme.js`, and `public/favicon.svg` consistent when changing the logo. Regenerate committed PNG icons with `node scripts/generate-icons.mjs` (requires Playwright's Chromium browser).

There is no backend, database, authentication, API key, account, tracking, analytics, advertising, or remote font dependency.

## Appearance and branding

The header's appearance button offers **Dark**, **Light**, and **Auto**. Auto follows device settings and is the default. An explicit choice is saved locally under `schoolcal.theme`, stays in sync across tabs, and is applied before the app renders. Appearance still works when browser storage is unavailable. The same menu includes **App colour**: choose one colour and matching light/dark shades are generated with readable contrast. The on-screen logo and browser icon follow the choice. Colour is saved separately under `schoolcal.colour`, syncs across tabs, and can be reset to blue. Desktop pages reserve scrollbar space so short and long pages stay aligned. Timetable print previews and PDFs use white paper, black/grey text and rules, and narrow subject-colour markers without coloured cell fills.

The palette generator lives in `public/colours.js`; `public/theme.js` applies preferences before React loads.

## Persistence and backup compatibility

The app version and backup schema version are independent. **App version 1.0.0 uses backup schema version 2.** The localStorage key remains `schoolcal.project.v1` for compatibility. JSON backups contain a `schemaVersion` and a `timetable` object; the importer accepts schemas 1 and 2.

Zod checks the shape before references and duplicate IDs/cells are checked. Imports are validated before replacing the current project. Appearance preferences are stored separately from the timetable backup.

## Rotation and calendar details

The [user guide](USER_GUIDE.md#how-week-rotation-works) explains teaching weeks and partial-week resets. Internally, rotation indexes are zero based and independent of labels; all views use `getRotationLabel()`. Weekday indexes follow JavaScript's convention: Sunday `0` through Saturday `6`. Reset exclusions are processed in end-date order; overlapping exclusions act as a union.

The exporter writes individual `VEVENT`s—**no `RRULE`**. Excluded dates, disabled days, and empty cells produce no lesson events. **Include fixed periods** optionally exports periods whose categories have Allow subjects switched off, using each period's name and times.

- Stable, collision-free UIDs derive from the project, date, weekday, period, and subject IDs.
- Text escapes commas, semicolons, backslashes, and line breaks; physical lines fold at 75 UTF-8 bytes with CRLF endings.
- School dates stay ISO **civil dates**, separate from times. UTC is used only as an internal arithmetic carrier for day addition, never to interpret user-entered school dates as instants.
- Lesson `DTSTART`/`DTEND` use the school's IANA `TZID`. A self-contained `VTIMEZONE` contains explicit transitions across the academic year and an extra year on either side, using the browser's timezone data. There are no timezone recurrence rules either.
- A London lesson entered as 09:00 stays at 09:00 through BST/GMT changes. The school's detected timezone can be edited in School year.
- Calendar overview shows totals, first/last lessons, and validation links. Lesson preview shows a selected teaching week. Export & share holds calendar export, JSON backups/import and device transfer. Preview and export share the fixed-period choice in app state. The legacy `#review` route opens the overview, and saved setup-step indices remain compatible.
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

- One project per browser/origin; no cloud sync or coordination between multiple open editing tabs. Use one editing tab and keep backups.
- Supports modern browsers, same-day periods, and one shared period structure across enabled school days. Overnight lessons and different bell schedules per weekday are outside this release.
- Bounds keep malformed imports and accidental huge calendars manageable: dates from 1900–2200, up to three years per project, 40 periods, 40 period categories, 100 subjects, 200 exclusions, and 2 MB backups. Normal school years are much smaller.
- Sample holidays are illustrative and must be checked against the actual school calendar. They are not a source of official term dates.
- Browser timezone rules depend on its installed IANA data. Use a current browser. Rare ambiguous/nonexistent lesson times during the overnight clock change follow calendar-client timezone interpretation.
- Automated phone testing uses Chromium and WebKit with iPhone viewports, not a physical iPhone or native Apple Calendar/Outlook. Actual calendar-client import and physical-printer output still need release-device checks.
- No homework, grades, messaging, notifications, exams, subscriptions, or OCR.

## Releases

Keep `package.json`, the root package entries in `package-lock.json`, and [CHANGELOG.md](../CHANGELOG.md) aligned with the app version. Backup schemas are versioned independently.

For a release, commit the changes, confirm the deployment workflow passes for that commit, create and push an annotated `vX.Y.Z` tag pointing to it, then publish a GitHub Release with user-facing notes and the live app link. GitHub provides source archives from the tag; using the hosted app does not require downloading source code.
