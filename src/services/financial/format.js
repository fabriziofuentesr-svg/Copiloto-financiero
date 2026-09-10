// Utilidades de formato y fechas, reutilizadas por toda la app.

const CURRENCY_CODES = {
  BOB: "BOB",
  USD: "USD",
};

export function normalizeCurrency(currency) {
  return currency === "USD" ? CURRENCY_CODES.USD : CURRENCY_CODES.BOB;
}

export function fmtBs(v, currency = "BOB") {
  const n = Number(v);
  return new Intl.NumberFormat("es-BO", {
    style: "currency",
    currency: normalizeCurrency(currency),
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(n) ? n : 0);
}

export function fmtPct(v, digits = 0) {
  const n = Number(v);
  return `${(Number.isFinite(n) ? n * 100 : 0).toFixed(digits)}%`;
}

// Las fechas introducidas por el usuario son fechas civiles (sin hora).
// Construirlas con new Date("YYYY-MM-DD") las interpreta como UTC y puede
// mostrarlas el día anterior en zonas como Bolivia. Solo las cadenas de fecha
// exactas se construyen en hora local; los timestamps completos conservan su
// instante original.
export function parseDate(date) {
  if (date instanceof Date) return new Date(date);
  if (typeof date === "string") {
    const match = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (match) return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  }
  return new Date(date);
}

export function fmtFecha(date) {
  const d = parseDate(date);
  return new Intl.DateTimeFormat("es-BO", { day: "2-digit", month: "short" }).format(d);
}

export function addDays(date, days) {
  const d = parseDate(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function addMonths(date, months) {
  const d = parseDate(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

export function startOfMonth(date = new Date()) {
  const d = parseDate(date);
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function isSameMonth(a, b) {
  const da = parseDate(a);
  const db = parseDate(b);
  return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth();
}

export function isPrevMonth(a, ref = new Date()) {
  const prev = addMonths(startOfMonth(ref), -1);
  return isSameMonth(a, prev);
}

// Próxima ocurrencia de un compromiso recurrente que cae un día fijo del mes.
export function nextOccurrence(dayOfMonth, ref = new Date()) {
  const reference = parseDate(ref);
  const day = Math.max(1, Math.floor(Number(dayOfMonth) || 1));
  const lastDay = new Date(reference.getFullYear(), reference.getMonth() + 1, 0).getDate();
  const candidate = new Date(
    reference.getFullYear(),
    reference.getMonth(),
    Math.min(day, lastDay)
  );
  const referenceDay = new Date(reference.getFullYear(), reference.getMonth(), reference.getDate());
  if (candidate < referenceDay) {
    const nextMonth = new Date(reference.getFullYear(), reference.getMonth() + 1, 1);
    const nextLastDay = new Date(nextMonth.getFullYear(), nextMonth.getMonth() + 1, 0).getDate();
    return new Date(nextMonth.getFullYear(), nextMonth.getMonth(), Math.min(day, nextLastDay));
  }
  return candidate;
}

export function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

