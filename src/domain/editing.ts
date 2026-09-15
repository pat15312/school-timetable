import { newId, sameCell, type Cell, type TimetableEntry } from "./model";
export function putEntry(
  entries: TimetableEntry[],
  cell: Cell,
  value: Omit<TimetableEntry, "id"> | null,
): TimetableEntry[] {
  const existing = entries.find((e) => sameCell(e, cell));
  const next = entries.filter((e) => !sameCell(e, cell));
  if (value) next.push({ ...value, ...cell, id: existing?.id ?? newId() });
  return next;
}
export function duplicateWeek(
  entries: TimetableEntry[],
  from: number,
  to: number,
): TimetableEntry[] {
  if (from === to) return entries;
  return [
    ...entries.filter((e) => e.rotationIndex !== to),
    ...entries
      .filter((e) => e.rotationIndex === from)
      .map((e) => ({ ...e, id: newId(), rotationIndex: to })),
  ];
}
