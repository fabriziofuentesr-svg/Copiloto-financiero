// Utilidades de formato y fechas, reutilizadas por toda la app.

export function fmtBs(v) {
  const n = Number(v);
  return new Intl.NumberFormat("es-BO", {
    style: "currency",
    currency: "BOB",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(n) ? n : 0);
}

export function fmtPct(v, digits = 0) {
  const n = Number(v);
  return `${(Number.isFinite(n) ? n * 100 : 0).toFixed(digits)}%`;
}

export function fmtFecha(date) {
  const d = date instanceof Date ? date : new Date(date);
  return new Intl.DateTimeFormat("es-BO", { day: "2-digit", month: "short" }).format(d);
}

export function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function addMonths(date, months) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

export function startOfMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function isSameMonth(a, b) {
  const da = new Date(a);
  const db = new Date(b);
  return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth();
}

export function isPrevMonth(a, ref = new Date()) {
  const prev = addMonths(startOfMonth(ref), -1);
  return isSameMonth(a, prev);
}

// Próxima ocurrencia de un compromiso recurrente que cae un día fijo del mes.
export function nextOccurrence(dayOfMonth, ref = new Date()) {
  const candidate = new Date(ref.getFullYear(), ref.getMonth(), dayOfMonth);
  if (candidate < ref) candidate.setMonth(candidate.getMonth() + 1);
  return candidate;
}

export function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}
