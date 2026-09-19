# Release history

## Unreleased

- Combine school-year and rotation settings into one setup page, keep timetable naming and creation in Your timetables, and move Install app into the sidebar. Existing drafts and rotation links still open the correct settings.

- Save multiple timetables on one device, with a desktop/mobile switcher, separate setup progress, renaming, independent duplication and confirmed deletion.
- Automatically migrate existing data; add JSON and QR/link imports without replacing saved timetables.
- Persist the active selection and each timetable’s fixed-period choice, prevent stale-tab overwrites, and use the active timetable for previews, exports and printing.

- Separate Calendar overview, Lesson preview, and Export & share pages.
- Generate a QR code or copy a transfer link to continue editing on another device, with JSON backup fallback for large timetables.
- Keep backup and import controls together on Export & share, including during unfinished setup.
- Share the fixed-period choice between lesson preview and calendar export, and preserve a restored draft's saved setup step.

## v1.0.0 — 18 September 2026

The first stable release of SchoolCal: build a school timetable, account for holidays, and export it to your calendar or print it for the wall.

### Included

- Guided setup for the school year, school days, time zone and one-to-four-week timetable rotation.
- Holidays and days off, with a choice to continue the rotation or reset it after a break.
- Editable periods and categories, each with a switch controlling whether subjects can be assigned.
- Subject colours, teachers and rooms; duplication and reordering for different classes; and overrides for individual lessons.
- Timetable placement, copying, pasting, clearing, undo and copying between rotation weeks.
- Calendar previews and holiday-aware `.ics` exports, optional fixed periods, and device sharing with a download fallback.
- A4 print/PDF layouts with one or two weeks per page, neutral backgrounds and subject-colour markers.
- Desktop and mobile layouts, sticky navigation, light/dark/automatic appearance and a custom app colour.
- Automatic local saving, project backups/imports, recovery of earlier backup formats and offline use after initial caching.

### Documentation

A shorter [README](README.md) introduces the app. Detailed instructions are in the [user guide](docs/USER_GUIDE.md); setup, testing and implementation notes are in the [development guide](docs/DEVELOPMENT.md).

### Before you start

Timetables are stored in the current browser. Keep project backups when moving devices or clearing browser data. Calendar imports are snapshots and need replacing when the timetable changes. All school days use the same period structure.

[Open SchoolCal](https://pat15312.github.io/school-timetable/)
