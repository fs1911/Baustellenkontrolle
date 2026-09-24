/** Formatierung nach Schweizer Konventionen (de-CH, Europe/Zurich). */
const TZ = "Europe/Zurich";

export function formatDate(value: Date | string | null | undefined): string {
  if (!value) return "–";
  const d = typeof value === "string" ? new Date(value.length === 10 ? `${value}T12:00:00Z` : value) : value;
  return new Intl.DateTimeFormat("de-CH", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: TZ }).format(d);
}

export function formatDateTime(value: Date | string | null | undefined): string {
  if (!value) return "–";
  const d = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("de-CH", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TZ,
  }).format(d);
}

export function formatNumber(n: number, digits = 0): string {
  return new Intl.NumberFormat("de-CH", { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(n);
}

export function formatPercent(n: number | null): string {
  if (n === null || Number.isNaN(n)) return "–";
  return `${formatNumber(n * 100, 0)} %`;
}

/** Datum (YYYY-MM-DD) in Zürcher Zeit. */
export function todayIso(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
}

export function toLocalInputValue(d: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour") === "24" ? "00" : get("hour")}:${get("minute")}`;
}

export function isOverdue(dueDate: string | null, status: string | null): boolean {
  if (!dueDate || !status) return false;
  return (status === "open" || status === "in_progress") && dueDate < todayIso();
}
