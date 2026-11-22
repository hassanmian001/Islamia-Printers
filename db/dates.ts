/**
 * Date filters arrive from the screens as "YYYY-MM-DD" and mean whole local
 * days, inclusive at both ends. Bills and payments are stored at local
 * midnight of the day they were entered for.
 */
const dayPattern = /^\d{4}-\d{2}-\d{2}$/;

export function parseDay(value: string | null | undefined): Date | null {
  const trimmed = value?.trim();

  if (!trimmed) {
    return null;
  }

  if (!dayPattern.test(trimmed)) {
    throw new Error(`"${trimmed}" is not a date.`);
  }

  const date = new Date(`${trimmed}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    throw new Error(`"${trimmed}" is not a date.`);
  }

  return date;
}

/** The first instant after the given day, so "up to and including" can be a strict less-than. */
export function endOfDayExclusive(value: string | null | undefined): Date | null {
  const day = parseDay(value);

  if (day === null) {
    return null;
  }

  return new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1);
}

/** Accepts a Date or a string; a bare "YYYY-MM-DD" is read as local midnight, not UTC. */
export function normalizeEntryDate(value: Date | string, label: string): Date {
  const date = typeof value === "string" && dayPattern.test(value.trim()) ? new Date(`${value.trim()}T00:00:00`) : value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error(`${label} is required.`);
  }

  return date;
}
