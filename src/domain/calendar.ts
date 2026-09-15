import { BRAND } from "../brand";
import { dateNumber, validTimezone } from "./dates";
import type { TimetableProject } from "./model";
import { generateOccurrences, type Occurrence } from "./occurrences";
import { validateProject } from "./validation";

export const escapeText = (text: string) =>
  text
    .replace(/\\/g, "\\\\")
    .replace(/\r\n|\r|\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
/** RFC 5545 limits physical lines to 75 octets, including the continuation space. */
export function foldLine(line: string): string {
  const encoder = new TextEncoder();
  let folded = "",
    size = 0;
  for (const character of line) {
    const bytes = encoder.encode(character).length;
    if (size + bytes > 75) {
      folded += "\r\n ";
      size = 1;
    }
    folded += character;
    size += bytes;
  }
  return folded;
}
const basic = (date: Date) =>
  date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "");
const wallTime = (date: string, time: string) =>
  `${date.replace(/-/g, "")}T${time.replace(":", "")}00`;
const formatOffset = (minutes: number) =>
  `${minutes < 0 ? "-" : "+"}${String(Math.floor(Math.abs(minutes) / 60)).padStart(2, "0")}${String(Math.abs(minutes) % 60).padStart(2, "0")}`;
const timezoneCache = new Map<string, string[]>();

/** Build explicit timezone transitions using the browser's IANA data. No recurrence rules.
 * Covers the full export year plus a year on either side, including half-hour DST.
 */
export function timezoneLines(
  zone: string,
  startYear: number,
  endYear: number,
): string[] {
  if (!validTimezone(zone)) throw new Error("Invalid school time zone.");
  const key = `${zone}:${startYear}:${endYear}`;
  const cached = timezoneCache.get(key);
  if (cached) return cached;
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: zone,
    timeZoneName: "longOffset",
  });
  const offsetAt = (time: number) => {
    const name = formatter
      .formatToParts(time)
      .find((p) => p.type === "timeZoneName")!.value;
    if (name === "GMT") return 0;
    const match = name.match(/GMT([+-])(\d{2}):(\d{2})/);
    if (!match)
      throw new Error("This browser cannot determine the school time zone.");
    return (match[1] === "-" ? -1 : 1) * (+match[2] * 60 + +match[3]);
  };
  const start = dateNumber(`${startYear - 1}-01-01`),
    end = dateNumber(`${endYear + 2}-01-01`);
  let previous = offsetAt(start);
  const lines = [
    "BEGIN:VTIMEZONE",
    `TZID:${zone}`,
    `X-LIC-LOCATION:${zone}`,
    "BEGIN:STANDARD",
    `DTSTART:${basic(new Date(start + previous * 60_000))}`,
    `TZOFFSETFROM:${formatOffset(previous)}`,
    `TZOFFSETTO:${formatOffset(previous)}`,
    "END:STANDARD",
  ];
  for (let time = start + 86_400_000; time <= end; time += 86_400_000) {
    const current = offsetAt(time);
    if (current === previous) continue;
    let low = time - 86_400_000,
      high = time;
    while (high - low > 1000) {
      const middle = Math.floor((low + high) / 2000) * 1000;
      if (offsetAt(middle) === previous) low = middle;
      else high = middle;
    }
    const kind = current > previous ? "DAYLIGHT" : "STANDARD";
    lines.push(
      `BEGIN:${kind}`,
      `DTSTART:${basic(new Date(high + previous * 60_000))}`,
      `TZOFFSETFROM:${formatOffset(previous)}`,
      `TZOFFSETTO:${formatOffset(current)}`,
      `END:${kind}`,
    );
    previous = current;
  }
  lines.push("END:VTIMEZONE");
  timezoneCache.set(key, lines);
  return lines;
}
export function buildCalendar(
  project: TimetableProject,
  includeBreaks = false,
  stamp = new Date(),
): string {
  const validation = validateProject(project);
  if (validation.errors.length) throw new Error(validation.errors.join(" "));
  const occurrences = generateOccurrences(project, includeBreaks);
  if (!occurrences.some((e) => !e.structural))
    throw new Error(
      "No lessons fall on actual school days. Check your dates and timetable.",
    );
  const zone = project.academicYear.timezone;
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "CALSCALE:GREGORIAN",
    `PRODID:${BRAND.prodId}`,
    `X-WR-CALNAME:${escapeText(project.name)}`,
    `X-WR-TIMEZONE:${zone}`,
    ...timezoneLines(
      zone,
      +project.academicYear.startDate.slice(0, 4),
      +project.academicYear.endDate.slice(0, 4),
    ),
  ];
  for (const event of occurrences)
    lines.push(...eventLines(event, zone, stamp));
  lines.push("END:VCALENDAR");
  return lines.map(foldLine).join("\r\n") + "\r\n";
}
function eventLines(event: Occurrence, zone: string, stamp: Date): string[] {
  const lines = [
    "BEGIN:VEVENT",
    `UID:${event.uid}`,
    `DTSTAMP:${basic(stamp)}Z`,
    `DTSTART;TZID=${zone}:${wallTime(event.date, event.startTime)}`,
    `DTEND;TZID=${zone}:${wallTime(event.date, event.endTime)}`,
    `SUMMARY:${escapeText(event.title)}`,
  ];
  if (event.room) lines.push(`LOCATION:${escapeText(event.room)}`);
  const description = [
    event.teacher && `Teacher: ${event.teacher}`,
    event.notes,
  ]
    .filter(Boolean)
    .join("\n");
  if (description) lines.push(`DESCRIPTION:${escapeText(description)}`);
  lines.push("END:VEVENT");
  return lines;
}
export function safeFilename(name: string): string {
  return (
    name
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 90) || "school"
  );
}
