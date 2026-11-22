/**
 * Formatting and parsing for the khata-style screens and documents. Amounts are
 * shown the way a printed statement of account shows them: 7,114 for whole
 * rupees, 7,114.50 only when there are paisa.
 */
export function formatAmount(cents: number) {
  const hasPaisa = Math.round(cents) % 100 !== 0;

  return (cents / 100).toLocaleString("en-PK", {
    minimumFractionDigits: hasPaisa ? 2 : 0,
    maximumFractionDigits: 2,
  });
}

/** A blank cell for zero, so a khata line only shows what was actually charged. */
export function formatAmountOrBlank(cents: number) {
  return cents === 0 ? "" : formatAmount(cents);
}

/** Rates keep two decimals when they have them (1.50), whole rupees otherwise. */
export function formatRate(cents: number) {
  return formatAmount(cents);
}

export function formatQty(qty: number) {
  return qty.toLocaleString("en-PK", { maximumFractionDigits: 3 });
}

export function formatDate(value: Date | string) {
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value));
}

/** "YYYY-MM-DD" of a local date, for <input type="date">. */
export function toDayInputValue(value: Date | string = new Date()) {
  const date = new Date(value);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${date.getFullYear()}-${month}-${day}`;
}

export function firstDayOfMonthInputValue(value: Date = new Date()) {
  return toDayInputValue(new Date(value.getFullYear(), value.getMonth(), 1));
}

/** Parses a rupee figure typed by hand. Empty is zero; anything else that is not a number is null. */
export function parseRupeesToCents(value: string): number | null {
  const trimmed = value.trim().replaceAll(",", "");

  if (trimmed === "") {
    return 0;
  }

  const amount = Number(trimmed);

  if (!Number.isFinite(amount)) {
    return null;
  }

  return Math.round(amount * 100);
}

export function parseQuantity(value: string): number | null {
  const trimmed = value.trim().replaceAll(",", "");

  if (trimmed === "") {
    return 0;
  }

  const qty = Number(trimmed);

  return Number.isFinite(qty) ? qty : null;
}
