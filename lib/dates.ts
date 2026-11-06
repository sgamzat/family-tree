// Partial dates: a genealogical date may be known only by year, by month and
// year, or fully. Shared by the client form and the server-side parser.

export type PartialDate = {
  year: number | null;
  month: number | null;
  day: number | null;
};

export const EMPTY_DATE: PartialDate = { year: null, month: null, day: null };

export const MIN_YEAR = 1700;
export const MAX_YEAR = 2100;

const DATE_HINT = "Введите дату как 12.05.1952, 05.1952 или просто 1952";

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function checkYear(year: number) {
  if (!Number.isInteger(year) || year < MIN_YEAR || year > MAX_YEAR) {
    throw new Error(`Год должен быть от ${MIN_YEAR} до ${MAX_YEAR}`);
  }
}

/** Validates a partial date, throwing a user-facing message if impossible. */
export function checkPartialDate(date: PartialDate): PartialDate {
  const { year, month, day } = date;
  if (year === null) {
    if (month !== null || day !== null) throw new Error(DATE_HINT);
    return EMPTY_DATE;
  }
  checkYear(year);
  if (month === null) {
    if (day !== null) throw new Error(DATE_HINT);
    return { year, month: null, day: null };
  }
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error("Месяц должен быть от 1 до 12");
  }
  if (day === null) return { year, month, day: null };
  if (!Number.isInteger(day) || day < 1 || day > daysInMonth(year, month)) {
    throw new Error(`В этом месяце нет ${day}-го числа`);
  }
  return { year, month, day };
}

/**
 * Parses what a person typed: "1952", "05.1952", "12.05.1952", "12051952",
 * "12/5/1952", "12,05,1952" or ISO "1952-05-12". Empty input → empty date.
 */
export function parseDateText(raw: string): PartialDate {
  const text = raw.trim();
  if (!text) return EMPTY_DATE;

  const iso = /^(\d{4})-(\d{1,2})(?:-(\d{1,2}))?$/.exec(text);
  if (iso) {
    return checkPartialDate({
      year: Number(iso[1]),
      month: Number(iso[2]),
      day: iso[3] ? Number(iso[3]) : null,
    });
  }

  if (/^\d+$/.test(text)) {
    if (text.length === 4) return checkPartialDate({ year: Number(text), month: null, day: null });
    if (text.length === 6) {
      return checkPartialDate({
        year: Number(text.slice(2)),
        month: Number(text.slice(0, 2)),
        day: null,
      });
    }
    if (text.length === 8) {
      return checkPartialDate({
        year: Number(text.slice(4)),
        month: Number(text.slice(2, 4)),
        day: Number(text.slice(0, 2)),
      });
    }
    throw new Error(DATE_HINT);
  }

  const parts = text.split(/[.,/\s-]+/).filter(Boolean);
  if (parts.some((part) => !/^\d+$/.test(part))) throw new Error(DATE_HINT);
  const last = parts[parts.length - 1];
  if (!last || last.length !== 4) throw new Error(DATE_HINT);
  if (parts.length === 2) {
    return checkPartialDate({ year: Number(parts[1]), month: Number(parts[0]), day: null });
  }
  if (parts.length === 3) {
    return checkPartialDate({
      year: Number(parts[2]),
      month: Number(parts[1]),
      day: Number(parts[0]),
    });
  }
  throw new Error(DATE_HINT);
}

/** "12.05.1952", "05.1952", "1952" or "". */
export function formatPartialDate(date: PartialDate): string {
  if (date.year === null) return "";
  if (date.month === null) return String(date.year);
  if (date.day === null) return `${pad(date.month)}.${date.year}`;
  return `${pad(date.day)}.${pad(date.month)}.${date.year}`;
}

/** Normalises typed text for display, leaving it alone if it does not parse yet. */
export function tidyDateText(raw: string): string {
  try {
    return formatPartialDate(parseDateText(raw));
  } catch {
    return raw.trim();
  }
}

/** Value for <input type="date">: the full date, or 1 January of a known year. */
export function toIsoForPicker(raw: string): string {
  try {
    const date = parseDateText(raw);
    if (date.year === null) return "";
    return `${date.year}-${pad(date.month ?? 1)}-${pad(date.day ?? 1)}`;
  } catch {
    return "";
  }
}

/** Compares two partial dates by their known precision; null if unknown. */
export function compareDates(a: PartialDate, b: PartialDate): number | null {
  if (a.year === null || b.year === null) return null;
  if (a.year !== b.year) return a.year - b.year;
  if (a.month === null || b.month === null) return 0;
  if (a.month !== b.month) return a.month - b.month;
  if (a.day === null || b.day === null) return 0;
  return a.day - b.day;
}
