import { gzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import fixture from "../../tests/fixtures/qr-transfer-project.json";
import { buildCalendar } from "./calendar";
import { sampleProject } from "./fixture";
import { createProject, type TimetableProject } from "./model";
import { parseProject } from "./persistence";
import { decodeTransfer, encodeTransfer, TRANSFER_PREFIX } from "./transfer";

function transferredIds(p: TimetableProject): TimetableProject {
  return {
    ...p,
    academicYear: {
      ...p.academicYear,
      exclusions: p.academicYear.exclusions.map((e, i) => ({
        ...e,
        id: `transfer-holiday-${i}`,
      })),
    },
    entries: p.entries.map((e, i) => ({ ...e, id: `transfer-entry-${i}` })),
  };
}

describe("editable timetable transfer", () => {
  it("preserves the full device-test fixture and produces an identical calendar", async () => {
    const p = parseProject(JSON.stringify(fixture));
    const hash = await encodeTransfer(p);
    const received = await decodeTransfer(hash);
    expect(received).toEqual(p);
    const stamp = new Date("2026-09-18T12:00:00Z");
    expect(buildCalendar(received, true, stamp)).toBe(
      buildCalendar(p, true, stamp),
    );
    // Fits the largest QR at medium correction, including the actual site URL.
    expect(
      new TextEncoder().encode(
        `https://pat15312.github.io/school-timetable/${hash}`,
      ).length,
    ).toBeLessThanOrEqual(2331);
  });

  it("preserves hidden cells, disabled categories, optional blanks, and event identities", async () => {
    const p = sampleProject();
    p.cycleLength = 1;
    p.academicYear.schoolWeekdays = [1, 3, 5];
    p.periodCategories[0].allowSubjects = false;
    p.subjects[0].shortName = "";
    p.subjects[0].teacher = "";
    delete p.subjects[1].room;
    p.entries[0].titleOverride = "";
    p.entries[0].teacherOverride = "";
    p.entries[0].roomOverride = "";
    p.entries[0].notes =
      'École 🧪\n"Notes", commas; backslashes \\ and symbols <>&';
    expect(await decodeTransfer(await encodeTransfer(p))).toEqual(
      transferredIds(p),
    );
  });

  it("retains incomplete setup and empty dates and times", async () => {
    const p = createProject();
    p.setupStep = 3;
    expect(await decodeTransfer(await encodeTransfer(p))).toEqual(p);
    const draft = sampleProject();
    draft.setupComplete = false;
    draft.setupStep = 5;
    draft.academicYear.startDate = "";
    draft.periods[0].startTime = "";
    expect(await decodeTransfer(await encodeTransfer(draft))).toEqual(
      transferredIds(draft),
    );
  });

  it("rejects malformed, truncated, oversized, and unsupported links", async () => {
    const valid = await encodeTransfer(sampleProject());
    for (const hash of [
      "#transfer=2.abc",
      TRANSFER_PREFIX,
      `${TRANSFER_PREFIX}***`,
      `${TRANSFER_PREFIX}${"a".repeat(32_001)}`,
      valid.slice(0, -8),
    ])
      await expect(decodeTransfer(hash)).rejects.toThrow(
        "Your saved timetable has not been changed",
      );
  });

  it("bounds decompression before parsing a highly compressed payload", async () => {
    const payload = gzipSync(Buffer.alloc(2_000_001)).toString("base64url");
    await expect(decodeTransfer(TRANSFER_PREFIX + payload)).rejects.toThrow(
      "Your saved timetable has not been changed",
    );
  });

  it("validates the source before encoding broken references", async () => {
    const p = sampleProject();
    p.entries[0].subjectId = "missing";
    await expect(encodeTransfer(p)).rejects.toThrow("missing subject");
  });
});
