import { z } from "zod";
import { type TimetableProject } from "./model";
import { parseProject, serializeProject } from "./persistence";

export const TRANSFER_PREFIX = "#transfer=1.";
const MAX_LINK_LENGTH = 32_000;
const MAX_DECOMPRESSED_BYTES = 2_000_000;
const text = z.string().max(4000);
const optionalText = text.nullable();
const index = z.number().int().nonnegative();
// Fixed field positions avoid repeating JSON keys. Record IDs used by calendar
// events are retained; entry/exclusion bookkeeping IDs are rebuilt on receipt.
const compactSchema = z.tuple([
  text,
  text,
  z.tuple([
    text,
    text,
    z.array(index).max(7),
    text,
    z.array(z.tuple([text, text, text, z.boolean()])).max(200),
  ]),
  z.number(),
  z.enum(["letters", "numbers"]),
  index,
  z.array(z.tuple([text, text, z.boolean()])).max(40),
  z.array(z.tuple([text, text, text, text, index, index])).max(40),
  z
    .array(
      z.tuple([text, text, optionalText, optionalText, optionalText, text]),
    )
    .max(100),
  z
    .array(
      z.tuple([
        index,
        index,
        index,
        index,
        optionalText,
        optionalText,
        optionalText,
        optionalText,
      ]),
    )
    .max(1120),
  z.boolean(),
  index,
  text,
  text,
]);
type Compact = z.infer<typeof compactSchema>;

function compact(p: TimetableProject): Compact {
  const y = p.academicYear;
  return [
    p.id,
    p.name,
    [
      y.startDate,
      y.endDate,
      y.schoolWeekdays,
      y.timezone,
      y.exclusions.map((e) => [
        e.name,
        e.startDate,
        e.endDate,
        e.resetRotationAfter,
      ]),
    ],
    p.cycleLength,
    p.rotationLabelStyle,
    p.initialRotationIndex,
    p.periodCategories.map((c) => [c.id, c.name, c.allowSubjects]),
    p.periods.map((x) => [
      x.id,
      x.name,
      x.startTime,
      x.endTime,
      p.periodCategories.findIndex((c) => c.id === x.categoryId),
      x.sortOrder,
    ]),
    p.subjects.map((s) => [
      s.id,
      s.name,
      s.shortName ?? null,
      s.teacher ?? null,
      s.room ?? null,
      s.colour,
    ]),
    p.entries.map((e) => [
      e.rotationIndex,
      e.weekday,
      p.periods.findIndex((x) => x.id === e.periodId),
      p.subjects.findIndex((s) => s.id === e.subjectId),
      e.titleOverride ?? null,
      e.teacherOverride ?? null,
      e.roomOverride ?? null,
      e.notes ?? null,
    ]),
    p.setupComplete,
    p.setupStep,
    p.createdAt,
    p.updatedAt,
  ];
}

function expand(data: unknown): TimetableProject {
  const [
    id,
    name,
    year,
    cycleLength,
    rotationLabelStyle,
    initialRotationIndex,
    categories,
    times,
    subjects,
    lessons,
    setupComplete,
    setupStep,
    createdAt,
    updatedAt,
  ] = compactSchema.parse(data);
  const periodCategories = categories.map(([id, name, allowSubjects]) => ({
    id,
    name,
    allowSubjects,
  }));
  const periods = times.map(
    ([id, name, startTime, endTime, category, sortOrder]) => ({
      id,
      name,
      startTime,
      endTime,
      categoryId: periodCategories[category]?.id,
      sortOrder,
    }),
  );
  // Existing backup validation also checks references, duplicate cells and IDs.
  return parseProject(
    JSON.stringify({
      schemaVersion: 2,
      timetable: {
        id,
        name,
        academicYear: {
          startDate: year[0],
          endDate: year[1],
          schoolWeekdays: year[2],
          timezone: year[3],
          exclusions: year[4].map(
            ([name, startDate, endDate, resetRotationAfter], i) => ({
              id: `transfer-holiday-${i}`,
              name,
              startDate,
              endDate,
              resetRotationAfter,
            }),
          ),
        },
        cycleLength,
        rotationLabelStyle,
        initialRotationIndex,
        periodCategories,
        periods,
        subjects: subjects.map(
          ([id, name, shortName, teacher, room, colour]) => ({
            id,
            name,
            shortName: shortName ?? undefined,
            teacher: teacher ?? undefined,
            room: room ?? undefined,
            colour,
          }),
        ),
        entries: lessons.map(
          (
            [
              rotationIndex,
              weekday,
              period,
              subject,
              titleOverride,
              teacherOverride,
              roomOverride,
              notes,
            ],
            i,
          ) => ({
            id: `transfer-entry-${i}`,
            rotationIndex,
            weekday,
            periodId: periods[period]?.id,
            subjectId: subjects[subject]?.[0],
            titleOverride: titleOverride ?? undefined,
            teacherOverride: teacherOverride ?? undefined,
            roomOverride: roomOverride ?? undefined,
            notes: notes ?? undefined,
          }),
        ),
        setupComplete,
        setupStep,
        createdAt,
        updatedAt,
      },
    }),
  );
}

function encodeIdentifiers(data: Compact): Uint8Array<ArrayBuffer> {
  const ids: string[] = [];
  function visit(value: unknown): unknown {
    if (
      typeof value === "string" &&
      /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(value)
    ) {
      let i = ids.indexOf(value);
      if (i === -1) {
        i = ids.length;
        ids.push(value);
      }
      return { id: i };
    }
    return Array.isArray(value) ? value.map(visit) : value;
  }
  const json = new TextEncoder().encode(JSON.stringify(visit(data)));
  const bytes = new Uint8Array(2 + ids.length * 16 + json.length);
  new DataView(bytes.buffer).setUint16(0, ids.length);
  ids.forEach((id, i) => {
    const hex = id.replaceAll("-", "");
    for (let j = 0; j < 16; j++)
      bytes[2 + i * 16 + j] = parseInt(hex.slice(j * 2, j * 2 + 2), 16);
  });
  bytes.set(json, 2 + ids.length * 16);
  return bytes;
}

function decodeIdentifiers(bytes: Uint8Array<ArrayBuffer>): unknown {
  if (bytes.length < 2) throw new Error("Incomplete transfer");
  const count = new DataView(bytes.buffer).getUint16(0);
  const end = 2 + count * 16;
  if (end >= bytes.length) throw new Error("Incomplete identifiers");
  const ids = Array.from({ length: count }, (_, i) => {
    const hex = Array.from(bytes.slice(2 + i * 16, 2 + (i + 1) * 16), (b) =>
      b.toString(16).padStart(2, "0"),
    ).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  });
  // Only the fixed tuple format and identifier tokens are accepted below.
  const json = JSON.parse(
    new TextDecoder("utf-8", { fatal: true }).decode(bytes.slice(end)),
  );
  function visit(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(visit);
    if (value && typeof value === "object") {
      const token = z.object({ id: index }).strict().parse(value);
      if (token.id >= ids.length) throw new Error("Missing identifier");
      return ids[token.id];
    }
    return value;
  }
  return visit(json);
}

async function transform(bytes: Uint8Array<ArrayBuffer>, decompress: boolean) {
  const stream = new Blob([bytes])
    .stream()
    .pipeThrough(
      decompress
        ? new DecompressionStream("gzip")
        : new CompressionStream("gzip"),
    );
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > MAX_DECOMPRESSED_BYTES) {
        await reader.cancel();
        throw new Error("Transfer is too large");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const result = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

export async function encodeTransfer(
  project: TimetableProject,
): Promise<string> {
  const validated = parseProject(serializeProject(project));
  const bytes = await transform(encodeIdentifiers(compact(validated)), false);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  const payload = btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
  if (payload.length > MAX_LINK_LENGTH)
    throw new Error(
      "This timetable is too large for a transfer link. Use a project backup instead.",
    );
  return TRANSFER_PREFIX + payload;
}

export async function decodeTransfer(hash: string): Promise<TimetableProject> {
  if (typeof DecompressionStream === "undefined")
    throw new Error(
      "This browser cannot open transfer links. Update your browser or import a project backup instead.",
    );
  try {
    if (!hash.startsWith(TRANSFER_PREFIX))
      throw new Error("Unsupported version");
    const payload = hash.slice(TRANSFER_PREFIX.length);
    if (
      !payload.length ||
      payload.length > MAX_LINK_LENGTH ||
      !/^[A-Za-z0-9_-]+$/.test(payload)
    )
      throw new Error("Invalid transfer");
    const binary = atob(payload.replaceAll("-", "+").replaceAll("_", "/"));
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    return expand(decodeIdentifiers(await transform(bytes, true)));
  } catch {
    throw new Error(
      "This timetable link is incomplete, damaged, or uses an unsupported format. Your saved timetable has not been changed.",
    );
  }
}
