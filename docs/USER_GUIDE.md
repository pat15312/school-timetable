# SchoolCal user guide

[Open SchoolCal](https://pat15312.github.io/school-timetable/) · [Back to the overview](../README.md)

## Set up your timetable

New timetables start empty. **Try a sample** loads an editable example; check all example dates against your school's calendar before using it.

1. **School year:** name the timetable, enter its first and last dates, choose school days, and check the school time zone. Click the timetable name or icon in the sidebar to return here.
2. **Timetable rotation:** choose a cycle of one to four weeks, letters or numbers for week labels, and the starting week.
3. **Holidays & days off:** add holidays, inset days and other exclusions, choosing whether each break continues the rotation or resets it to the first week.
4. **Lesson times:** enter the periods in your school day, including lessons and fixed activities such as registration and lunch.
5. **Subjects:** add names, colours, teachers and rooms.
6. **Build timetable:** select a subject and tap its cells.
7. **Lesson preview:** finishing setup opens lessons on actual dates, with totals and progress for the year's lessons and teaching weeks. **Export & share** provides calendar downloads, backups and device transfers. **Print timetable** opens the paper preview.

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

Visible buttons provide the same actions for touch. Undo keeps the last 80 entry edits in memory and resets when a project is replaced or the page is reloaded. Week replacement requires an explicit confirmation in the copy dialog.

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

The **Your year so far** summary shows total lessons and teaching weeks, completed counts, and the percentage done. A lesson counts as completed once its scheduled end time passes. A teaching week counts once the final period on its last school day ends; holiday-only weeks are excluded and partial weeks count as one teaching week. Progress uses the current time in the school's time zone, refreshes while the page is open, and stays the same when you browse another week. These are scheduled progress estimates, so they do not track attendance or cancellations that are not entered as days off.

**Include fixed periods** also includes activities whose categories have **Allow subjects** switched off. This choice is shared between **Lesson preview** and **Export & share** while the app is open, so the preview matches the calendar file. It defaults to off when you reopen the app. Fixed periods do not increase the lesson total or its completion percentage.

In **Export & share → Add to your calendar app**, choose **Download calendar**. Calendar export becomes available once the timetable is valid and has lessons on actual school days. The calendar-import instructions are expandable beneath the download controls.

If calendar export is disabled, the page lists the setup issues with links to fix them. You need valid school dates, a school time zone, school days, lesson times, named subjects and at least one scheduled lesson on an actual school day. You do not need to fill every timetable cell, and warnings do not block export. Backups and device transfers remain available while you are setting up.

Open `.ics` files with Apple Calendar or Outlook, or use Google Calendar's desktop **Settings → Import & export**. Where file sharing is supported, **Share calendar** opens the device's sharing menu to send the `.ics` file through another app. If the browser blocks sharing, **Download to share** saves the file so you can attach it yourself. Cancelling the sharing menu does not download anything.

Calendar imports are snapshots: later edits in SchoolCal do not update an imported calendar. Use a dedicated school calendar and remove the previous import before replacing it to avoid duplicates. SchoolCal does not provide a calendar subscription or connect directly to a calendar account.

Lesson times follow the school time zone, including daylight-saving changes. Check the time zone in **School year** if the preview looks wrong.

## Copy to another device

Open **Export & share → Copy to another device** and choose either option:

- **Copy transfer link:** send the copied link to your other device and open it in SchoolCal. If automatic copying is unavailable, SchoolCal shows a selectable link.
- **Show QR code:** scan the code with your other device’s camera and open the link in SchoolCal.

With either option, review the timetable summary, then choose **Use this timetable**. SchoolCal asks before replacing the timetable already on that device and offers a backup of it first.

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

After the app has loaded and cached successfully, it can open offline with your saved timetable. Updates prompt before reloading. Use **Install app** where supported; on iPhone, open SchoolCal in Safari and choose **Share → Add to Home Screen**.

Your saved timetable belongs to the current browser and site address. Clearing website data, switching browsers or using a different device can leave you without your project. Private browsing or storage limits may prevent saving; the app shows an error and offers a backup. Use **Export & share → Back up or restore → Download backup (.json)** for recovery or manual transfer; **Import backup (.json)** checks the file and asks before replacing your timetable. Older SchoolCal backups upgrade automatically. Unreadable saved data can also be downloaded for recovery.

SchoolCal stores one timetable in the current browser. Use one editing tab at a time: timetable edits are not coordinated across tabs and there is no automatic cloud sync. A project backup lets you transfer work manually.

For technical limits, browser testing and deployment details, see the [development guide](DEVELOPMENT.md).
