# SchoolCal user guide

[Open SchoolCal](https://pat15312.github.io/school-timetable/) · [Back to the overview](../README.md)

## Manage your timetables

Select the active timetable name in the sidebar, or in the top bar on mobile, to open **Your timetables**. Choose **New timetable** to start the setup flow. Select any saved timetable to resume it, including its unfinished setup.

Use **Rename**, **Duplicate** or **Delete** beside a timetable. A duplicate has independent settings, subjects and lessons, plus a new identity for calendar exports. Deleting asks for confirmation. If you delete the active timetable, another opens; deleting the last opens a new, empty setup.

SchoolCal remembers the active timetable when you reopen it. Each timetable keeps its own fixed-period choice for preview and calendar export. App appearance is shared. Preview, JSON backup, QR/link transfer, calendar export and printing all use the active timetable.

Existing single-timetable data upgrades automatically. Backups and incoming transfers add a separate timetable after confirmation, keeping saved work. An untouched empty starter may be reused. If the received timetable's identity already exists on this device, the new copy receives a fresh one.

## Set up your timetable

New timetables start empty as **Untitled timetable**. Rename them in **Your timetables**. **Try a sample** loads an editable example; check all example dates against your school's calendar before using it.

1. **School year & rotation:** enter the first and last school dates, choose school days, and check the school time zone. Choose a cycle of one to four weeks, letters or numbers for week labels, and the starting week. Return to these settings from the navigation.
2. **Holidays & days off:** add holidays, inset days and other exclusions, choosing whether each break continues the rotation or resets it to the first week.
3. **Lesson times:** enter the periods in your school day, including lessons and fixed activities such as registration and lunch.
4. **Subjects:** add names, colours, teachers and rooms.
5. **Build timetable:** select a subject and tap its cells.
6. **Lesson preview:** finishing setup opens lessons on actual dates, with totals and progress for the year's lessons and teaching weeks. **Export & share** provides calendar downloads, backups and device transfers. **Print timetable** opens the paper preview.

**Export & share** is also available during setup so you can back up or transfer an unfinished timetable.

The menu button remains available as you scroll on mobile.

## Editing subjects and lessons

Select a subject in the palette and tap multiple cells to place it quickly. Defaults for teacher and room remain linked to the subject. Switch to **Select**, choose a lesson, and use **Edit lesson** for explicit title, teacher, room, or note overrides. Uncheck an override to return to the subject default; an explicitly empty teacher/room suppresses that default.

In **Subjects**, choose **Duplicate** to create another version with the same name and colour, then change its teacher or room before saving. The copy appears beside its source. Use the up/down arrows to reorder the library and timetable picker; editing keeps that order. Subjects with matching picker names show their teacher and room so you can select the right version.

- Ctrl/⌘ C: copy selected entry
- Ctrl/⌘ V: paste into selected cell (including another rotation week)
- Delete / Backspace: clear the selected entry
- Ctrl/⌘ Z: undo an entry edit or week duplication
- Escape: stop painting / clear selection
- Arrow keys: move through editable grid cells

Visible buttons provide the same actions for touch. Undo keeps the last 80 entry edits in memory and resets when you switch timetables or reload the page. Week replacement requires an explicit confirmation in the copy dialog.

## Periods and categories

Each period belongs to a category with an **Allow subjects** switch. When off, the period displays its name as a fixed row in the timetable and printout; its saved lessons remain stored and return when the switch is turned on. This setting applies to all periods using the category, regardless of its name.

In **Lesson times → Edit categories**, add, edit or delete the choices shown in the Category dropdown. New projects start with Lesson (subjects on), Registration, Break and Lunch (subjects off). Renaming a category also updates periods whose names exactly matched the old category name; custom period names are preserved. Deleting a category in use requires a replacement, keeping its periods and saved lessons.

Choose **Add period**, select a category, and enter a name and times. New periods are inserted by start time. Names and times remain editable in the list; use the arrows to reorder or the bin to delete a period. For example, rename the Registration category to **Tutor period**, or create an **Assembly** category with subjects switched off.

All school days share the same period structure. Periods must start and finish on the same day.

## How week rotation works

1. Weeks run **Monday–Sunday**.
2. A teaching week contains at least one enabled school day inside the academic year that is not excluded.
3. The first teaching week uses the selected starting rotation. A midweek start still counts as that week.
4. Each subsequent teaching week advances the rotation once. Full weeks without teaching days consume **no rotation week**.
5. A normal holiday continues the sequence: `Week 1 → holiday → Week 2`.
6. A reset holiday sets the first teaching week after the holiday to `Week 1` / `Week A`. Multiple holidays are processed in date order; overlapping exclusions act as a union.

**Partial-week reset rule:** a week has one label throughout. A reset applies to the first week whose **first actual teaching day** is after the exclusion. If a short break interrupts a week already underway, finish that week's existing rotation, then reset the next teaching week. If a holiday ends midweek and there was no teaching earlier that week, the remaining days start the reset week. This avoids retroactively relabelling lessons before an inset day.

Reducing the cycle length or hiding a school day preserves its entries so they return when enabled again.

## Export and share your calendar

**Lesson preview** shows lessons on actual dates: choose a teaching week, move backwards/forwards, or jump to a date. Holidays, disabled school days and empty timetable cells are excluded.

The preview opens on the current teaching week until the last period on its final school day ends, then moves to the next teaching week. Holiday-only weeks are skipped. Before the year starts it shows the first week; after the year ends it shows the last. This follows the school's time zone and updates while the page is open. If you choose a week or jump to a date, your selection stays put until you leave or reload the page.

The **Your year so far** summary shows total lessons and teaching weeks, completed counts, and the percentage done. A lesson counts as completed once its scheduled end time passes. A teaching week counts once the final period on its last school day ends; holiday-only weeks are excluded and partial weeks count as one teaching week. Progress uses the current time in the school's time zone, refreshes while the page is open, and stays the same when you browse another week. These are scheduled progress estimates, so they do not track attendance or cancellations that are not entered as days off.

**Include fixed periods** also includes activities whose categories have **Allow subjects** switched off. This choice is shared between **Lesson preview** and **Export & share** and saved separately for each timetable, so the preview matches the calendar file. Fixed periods do not increase the lesson total or its completion percentage.

In **Export & share → Add to your calendar app**, choose **Download calendar**. Calendar export becomes available once the timetable is valid and has lessons on actual school days. The calendar-import instructions are expandable beneath the download controls.

If calendar export is disabled, the page lists the setup issues with links to fix them. You need valid school dates, a school time zone, school days, lesson times, named subjects and at least one scheduled lesson on an actual school day. You do not need to fill every timetable cell, and warnings do not block export. Backups and device transfers remain available while you are setting up.

Open `.ics` files with Apple Calendar or Outlook, or use Google Calendar's desktop **Settings → Import & export**. Where file sharing is supported, **Share calendar** opens the device's sharing menu to send the `.ics` file through another app. If the browser blocks sharing, **Download to share** saves the file so you can attach it yourself. Cancelling the sharing menu does not download anything.

Calendar imports are snapshots: later edits in SchoolCal do not update an imported calendar. Use a dedicated school calendar and remove the previous import before replacing it to avoid duplicates. SchoolCal does not provide a calendar subscription or connect directly to a calendar account.

Lesson times follow the school time zone, including daylight-saving changes. Check the time zone in **School year & rotation** if the preview looks wrong.

## Edit in Excel or Google Sheets

In **Export & share → Edit in a spreadsheet**, choose **Download template (.xlsx)** to start, or **Export spreadsheet (.xlsx)** to edit the active timetable. This is also available during setup.

1. Open the workbook in Excel or Google Sheets. The **Read me** sheet explains the format. Replace the example subjects and check the example lesson times in a new template.
2. Fill in **Settings**, **Periods** and **Subjects**. Enter dates as `YYYY-MM-DD` and times as `HH:mm` using the 24-hour clock. Excel date/time cells also work. Give each subject and period a unique code; keep codes unchanged when renaming existing items.
3. Put subject codes in the **Week 1–4** grids, using the dropdowns or copy/paste. Week 1 is Week A when using letter labels. Leave free cells empty. All four weeks and all seven days are kept, even when hidden by your settings.
4. Add **Holidays** if needed. **Categories** controls fixed periods. **Lesson details** optionally overrides a lesson's title, teacher, room or notes; set its override column to Yes to use that value. An empty teacher or room with Yes deliberately clears the subject default.
5. Save as `.xlsx`. In Google Sheets, choose **File → Download → Microsoft Excel (.xlsx)**.
6. Choose **Import spreadsheet (.xlsx)** in SchoolCal. Review the settings, lesson list and warnings, then choose **Add timetable**. If there are errors, SchoolCal identifies the sheet and cell to fix. Cancel leaves your saved work unchanged.

Imports always receive a new timetable identity and keep saved work. They become the active timetable after saving. Valid unfinished files remain drafts and resume setup. Subject and period order follows the spreadsheet rows. If you import the same file again, it creates another copy. Keep JSON backups when you need an exact copy of a timetable's original identity.

Use SchoolCal's template or its exported workbook: arbitrary school spreadsheets, CSV, formulas, merged cells and photos are not supported. Keep the sheet names and headings. Extra sheets are ignored with a warning; template data in extra columns is rejected to avoid silently losing it. Limits are 2 MB, 40 periods, 100 subjects, 40 categories, 200 holidays and four rotation weeks. Processing happens on your device and works offline once the app is cached. Google Sheets itself requires using Google's service; SchoolCal has no account connection or automatic spreadsheet sync.

## Copy to another device

Open **Export & share → Copy to another device** and choose either option:

- **Copy transfer link:** send the copied link to your other device and open it in SchoolCal. If automatic copying is unavailable, SchoolCal shows a selectable link.
- **Show QR code:** scan the code with your other device’s camera and open the link in SchoolCal.

With either option, review the timetable summary, then choose **Use this timetable**. SchoolCal adds it as a separate timetable and keeps any saved work on that device.

Both options contain the editable configuration, including subjects, times, holidays, lesson overrides and notes. Drafts resume at their saved setup step. Your devices do not need to share a network; the receiving device needs to be able to open SchoolCal. Nothing needs to be uploaded to create the link or code. Share them only with someone you want to have a copy.

This is a copy at the time you share it. Later changes do not synchronise. Choose **Copy transfer link** or **Show QR code** again after editing to transfer the updated version.

Some timetables are too large for a single QR code, but can still be copied using a transfer link. For configurations too large for a link, download a JSON backup and import it on the other device.

## Print or save a PDF

**Print timetable** opens a dedicated preview, separate from the editor:

- **One week per page:** A4 landscape.
- **Two weeks per page:** A4 portrait, with a final unpaired week for a three-week cycle.

The print layout includes paper orientation, margins, fixed page boundaries, subject labels, times, room/teacher details, and structural rows. Controls and navigation are excluded. Borders and text keep the timetable understandable in greyscale. Unusually long school days scale to fit without dropping rows; landscape offers more room for readable text. Select A4 and disable the browser's headers/footers; choose **Save as PDF** for a digital copy.

Printouts use white paper, black/grey text and rules, and narrow subject-colour markers without coloured cell fills. Your app colour and dark/light theme do not tint the page.

## Appearance

Use the appearance button in the top bar to choose **Light**, **Dark** or **Auto**. Auto follows your device and is the default.

Choose a single **App colour** and SchoolCal generates matching shades for both themes. The sidebar logo and browser icon use that colour too. You can reset it to blue at any time. Preferences are remembered in your browser and stay in sync across tabs.

## Saving, backups and offline use

Editing and file creation happen on your device. SchoolCal does not upload your timetable; choosing to share a calendar hands that file to the app you select. The hosting provider may keep ordinary website access logs when you load the app; those requests contain no timetable data.

After the app has loaded and cached successfully, it can open offline with your saved timetable. Updates prompt before reloading. Choose **Install app** in the sidebar, above **Help & privacy**, where supported; on iPhone, open SchoolCal in Safari and choose **Share → Add to Home Screen**.

Your saved timetable belongs to the current browser and site address. Clearing website data, switching browsers or using a different device can leave you without your project. Private browsing or storage limits may prevent saving; the app shows an error and offers a backup. Use **Export & share → Back up or restore → Download backup (.json)** for recovery or manual transfer; **Import backup (.json)** checks the file and asks before adding a separate timetable. Download a backup for each timetable you want to keep. Older SchoolCal backups upgrade automatically. Unreadable saved data can also be downloaded for recovery.

SchoolCal stores your timetables in the current browser. Use one editing tab at a time: if another tab saves a change, SchoolCal blocks stale saves and asks you to back up your edits and reload. There is no automatic cloud sync. A project backup lets you transfer one timetable at a time.

When an app update is ready, choose **Save and reload**. SchoolCal saves first and reloads once the new version takes control. If saving fails, the page stays open with your edits. Updates installed by another tab also wait for you to choose reload.

For technical limits, browser testing and deployment details, see the [development guide](DEVELOPMENT.md).
