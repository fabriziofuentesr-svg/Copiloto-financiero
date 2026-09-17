export const FUTURE_MOVEMENT_ERROR = "No puedes registrar movimientos con una fecha futura. Elige hoy o una fecha anterior.";

export function profileToday(profile = {}, now = new Date()) {
  let formatter;
  try {
    formatter = new Intl.DateTimeFormat("en", { timeZone: profile.timezone || "America/La_Paz", year: "numeric", month: "2-digit", day: "2-digit" });
  } catch {
    formatter = new Intl.DateTimeFormat("en", { timeZone: "America/La_Paz", year: "numeric", month: "2-digit", day: "2-digit" });
  }
  const parts = Object.fromEntries(formatter.formatToParts(now).map(part => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function validateMovementDate(date, profile, now) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || "")) throw new Error("Elige una fecha válida para el movimiento.");
  const [year, month, day] = date.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) throw new Error("Elige una fecha válida para el movimiento.");
  if (date > profileToday(profile, now)) throw new Error(FUTURE_MOVEMENT_ERROR);
  return date;
}

// Legacy future records remain in the ledger. New or edited records must be facts.
export function validateMovementWrites(previousState, nextState, now) {
  const previous = new Map((previousState?.transactions || []).map(tx => [tx.id, tx]));
  for (const tx of nextState.transactions || []) {
    const old = previous.get(tx.id);
    if (!old || ["date", "amount", "type", "accountId"].some(key => old[key] !== tx[key])) {
      validateMovementDate(tx.date, nextState.profile, now);
    }
  }
}
