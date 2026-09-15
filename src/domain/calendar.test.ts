import { describe, expect, it } from "vitest";
import ICAL from "ical.js";
import { buildCalendar, escapeText, foldLine, safeFilename } from "./calendar";
import { generateOccurrences } from "./occurrences";
import { testProject } from "./test-helpers";

function parsed(text: string) {
  const calendar = new ICAL.Component(ICAL.parse(text));
  const zone = new ICAL.Timezone(calendar.getFirstSubcomponent("vtimezone")!);
  ICAL.TimezoneService.register(zone, zone.tzid);
  return {
    calendar,
    events: calendar
      .getAllSubcomponents("vevent")
      .map((component) => new ICAL.Event(component)),
  };
}
describe("RFC 5545 calendar export", () => {
  it("has valid boundaries, required fields, CRLF endings, and exactly one VEVENT per occurrence", () => {
    const p = testProject(),
      text = buildCalendar(p),
      { events, calendar } = parsed(text);
    expect(
      text.startsWith(
        "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nCALSCALE:GREGORIAN\r\n",
      ),
    ).toBe(true);
    expect(text.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(text).not.toMatch(/(?<!\r)\n/);
    expect(calendar.getFirstPropertyValue("prodid")).toContain("SchoolCal");
    expect(events).toHaveLength(generateOccurrences(p).length);
    expect(text).not.toContain("RRULE");
    expect(
      events.every((e) => e.uid && e.startDate && e.endDate && e.summary),
    ).toBe(true);
    expect(
      events.every((e) => e.component.getFirstPropertyValue("dtstamp")),
    ).toBe(true);
  });
  it("gives every event a stable, unique UID independently of export time", () => {
    const p = testProject();
    const a = parsed(
      buildCalendar(p, false, new Date("2026-01-01T00:00:00Z")),
    ).events.map((e) => e.uid);
    const b = parsed(
      buildCalendar(p, false, new Date("2026-02-01T00:00:00Z")),
    ).events.map((e) => e.uid);
    expect(a).toEqual(b);
    expect(new Set(a).size).toBe(a.length);
    p.subjects[0].room = "M99";
    expect(parsed(buildCalendar(p)).events.map((e) => e.uid)).toEqual(a);
  });
  it("round-trips punctuation, newlines, backslashes, emoji, and long Unicode text", () => {
    const p = testProject();
    p.subjects[0].name = "Maths, science; \\ café 🧪".repeat(12);
    p.subjects[0].teacher = "Jones, A; B\\C";
    p.subjects[0].room = "Lab, 2; North";
    p.entries.find((e) => e.rotationIndex === 0 && e.weekday === 1)!.notes =
      "First line\r\nSecond line\nThird";
    const text = buildCalendar(p),
      first = parsed(text).events[0];
    expect(first.summary).toBe(p.subjects[0].name);
    expect(first.location).toBe(p.subjects[0].room);
    expect(first.description).toBe(
      "Teacher: Jones, A; B\\C\nFirst line\nSecond line\nThird",
    );
    expect(
      text
        .split("\r\n")
        .every((line) => new TextEncoder().encode(line).length <= 75),
    ).toBe(true);
  });
  it("folds on UTF-8 character boundaries and includes the leading space in the byte limit", () => {
    const line = "SUMMARY:" + "é🧪".repeat(60),
      folded = foldLine(line);
    expect(folded.replace(/\r\n /g, "")).toBe(line);
    expect(
      folded
        .split("\r\n")
        .every((part) => new TextEncoder().encode(part).length <= 75),
    ).toBe(true);
    expect(escapeText("a,b;c\\d\r\ne")).toBe("a\\,b\\;c\\\\d\\ne");
  });
  it("preserves 09:00 in London across BST, GMT, and the spring change", () => {
    const events = parsed(buildCalendar(testProject())).events;
    for (const date of ["2026-09-07", "2026-10-26", "2027-03-29"]) {
      const event = events.find((e) =>
        e.startDate.toString().startsWith(date),
      )!;
      expect(event.startDate.hour).toBe(9);
      expect(event.endDate.hour).toBe(10);
      const utc = event.startDate.convertToZone(ICAL.Timezone.utcTimezone);
      expect(utc.hour).toBe(date === "2026-10-26" ? 9 : 8);
    }
  });
  it.each([
    ["America/New_York", "2026-09-07", 13],
    ["America/New_York", "2026-11-02", 14],
    ["Asia/Kolkata", "2026-09-07", 3],
    ["Australia/Lord_Howe", "2026-09-07", 22],
  ])("encodes explicit zone %s correctly on %s", (zone, date, utcHour) => {
    const p = testProject();
    p.academicYear.timezone = zone;
    const event = parsed(buildCalendar(p)).events.find((e) =>
      e.startDate.toString().startsWith(date),
    )!;
    expect(event.startDate.hour).toBe(9);
    expect(event.startDate.convertToZone(ICAL.Timezone.utcTimezone).hour).toBe(
      utcHour,
    );
    if (zone === "Asia/Kolkata" || zone === "Australia/Lord_Howe")
      expect(
        event.startDate.convertToZone(ICAL.Timezone.utcTimezone).minute,
      ).toBe(30);
  });
  it("sanitizes filenames and prevents content-line injection", () => {
    expect(safeFilename("École / Timetable 🎒")).toBe("ecole-timetable");
    expect(safeFilename("...")).toBe("school");
    const p = testProject();
    p.subjects[0].name = "Lesson\r\nEND:VEVENT\r\nBEGIN:VEVENT";
    expect(parsed(buildCalendar(p)).events).toHaveLength(
      generateOccurrences(p).length,
    );
    p.academicYear.timezone = "Europe/London\r\nINJECTED";
    expect(() => buildCalendar(p)).toThrow();
  });
  it("rejects incomplete projects and calendars with no actual lessons", () => {
    const p = testProject();
    p.name = "";
    expect(() => buildCalendar(p)).toThrow("name");
    p.name = "School";
    p.academicYear.schoolWeekdays = [1];
    p.entries = p.entries.filter((e) => e.weekday === 2);
    expect(() => buildCalendar(p, true)).toThrow();
    p.entries = testProject().entries;
    p.academicYear.startDate = "2026-09-08";
    p.academicYear.endDate = "2026-09-11";
    expect(() => buildCalendar(p)).toThrow("No lessons");
  });
});
