# QR timetable transfer test

SchoolCal can generate and receive timetables through `#transfer=1.…` links. Use **Export & share → Show QR code** to create a code from the current configuration. Multiple timetables and spreadsheet import are separate future features.

The destination site must support transfer links. The earlier scan-only prototype had harmless padding and did not contain a timetable; use the complete fixture or an in-app generated QR for validation.

## Device test

1. On the sending device, import [the fixed reference](../tests/fixtures/qr-transfer-project.json) using **Export & share → Import backup (.json)**, then choose **Show QR code**. Scan it on the receiving device. If SchoolCal offers an application update, save and reload, then scan again.
2. Check that the confirmation shows **QR transfer test · Alex**, a four-week cycle, 10 subjects and 100 lesson slots.
3. Back up any existing timetable on the receiving device, then choose **Use this timetable**.
4. Inspect Weeks A–D and the school-year settings, holidays, periods and subjects. The school year starts on Week B.
5. Before editing anything, use **Export & share → Download backup (.json)**. Compare the parsed JSON with [the fixed reference](../tests/fixtures/qr-transfer-project.json), or return the exported file for comparison. Reloading and switching views should not change the reference data.
6. After exporting the untouched backup, try editing a lesson and reloading to check that work can continue on this device.

The fixture includes five exclusions, eight periods, subject colours and short names, custom tutor-period naming, teacher and room defaults, overrides, deliberately empty teacher/room fields, an absent default teacher, accented characters, a multiline note and a tick symbol. Monday's first lesson in Week A is **Algebra workshop**, with **Dr O’Neill**, room **B12**, and a two-line calculator note.

## Representation and validation

The URL fragment contains a versioned tuple representation, a compact UUID table, gzip compression and URL-safe Base64. All persistent configuration fields are represented. Project, category, period and subject IDs are retained. Entry and holiday IDs are local bookkeeping identifiers and are rebuilt as `transfer-entry-N` and `transfer-holiday-N`; these do not affect calendar event UIDs. The fixture uses those same bookkeeping IDs from the outset so its exported JSON can be compared exactly.

Missing optional fields and explicitly empty strings remain distinct. Incomplete drafts and hidden timetable cells are retained. Import validates the decompressed structure and references before offering replacement. Link size and decompression are bounded. Cancelling or rejecting a transfer leaves the current timetable intact. Accepting clears the transfer payload from the address bar and saves through the existing persistence path.

Timetable data stays in the URL fragment and the receiving browser. The app does not upload it. Anyone with the complete link or QR has the transferred copy. Transfers are snapshots; later edits do not synchronise between devices.

The tests independently decode the generated QR image, then compare every fixture field after import into a separate browser context, page reload and JSON download in desktop and mobile Chromium and WebKit. They also cover updated configurations, oversized codes, clipboard fallback and draft backup/restore. Offline generation is checked in Chromium, where Playwright supports service-worker controls. Unit checks also compare the generated calendar byte-for-byte and cover hidden cells, incomplete drafts, blank overrides, invalid links and decompression limits.
