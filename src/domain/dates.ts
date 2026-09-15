/** Civil dates use UTC only as an arithmetic carrier, never as an instant in the user's zone. */
const DAY_MS = 86_400_000;
export function dateNumber(iso: string): number {
  const [year, month, day] = iso.split("-").map(Number);
  const d = new Date(0);
  d.setUTCFullYear(year, month - 1, day);
  d.setUTCHours(0, 0, 0, 0);
  return d.getTime();
}
export function validDate(iso: string): boolean {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(iso) &&
    iso >= "1900-01-01" &&
    iso <= "2200-12-31" &&
    new Date(dateNumber(iso)).toISOString().slice(0, 10) === iso
  );
}
export const addDays = (iso: string, days: number) =>
  new Date(dateNumber(iso) + days * DAY_MS).toISOString().slice(0, 10);
export const weekday = (iso: string) => new Date(dateNumber(iso)).getUTCDay();
export const mondayOf = (iso: string) =>
  addDays(iso, -((weekday(iso) + 6) % 7));
export const daysBetween = (start: string, end: string) =>
  (dateNumber(end) - dateNumber(start)) / DAY_MS;
export function formatDate(
  iso: string,
  options: Intl.DateTimeFormatOptions = {
    day: "numeric",
    month: "short",
    year: "numeric",
  },
): string {
  if (!validDate(iso)) return "Not set";
  return new Intl.DateTimeFormat(undefined, {
    ...options,
    timeZone: "UTC",
  }).format(dateNumber(iso));
}
export function validTimezone(zone: string): boolean {
  if (!/^[A-Za-z0-9_+\-/]+$/.test(zone)) return false;
  try {
    new Intl.DateTimeFormat("en", { timeZone: zone }).format();
    return true;
  } catch {
    return false;
  }
}
export const validTime = (time: string) =>
  /^([01]\d|2[0-3]):[0-5]\d$/.test(time);
export const dateRange = (start: string, end: string) =>
  `${formatDate(start)} – ${formatDate(end)}`;
