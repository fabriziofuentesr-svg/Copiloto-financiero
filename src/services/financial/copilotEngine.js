import { calculateAvailableMoney, calculateFinancialHealth, getCategoryTrends, getMonthlyComparison, projectCashFlow, summarizePeriod } from "./calculations.js";
import { startOfMonth } from "./format.js";
import { evaluatePurchase } from "./purchaseAdvisor.js";
import { estimateGoalCompletion } from "./goals.js";
import { fmtBs, fmtPct } from "./format.js";

export function parseLocalizedAmount(value) {
  const raw = String(value ?? "").replace(/\s/g, "");
  if (!raw) return null;
  let normalized = raw;
  const lastComma = raw.lastIndexOf(",");
  const lastDot = raw.lastIndexOf(".");
  if (lastComma >= 0 && lastDot >= 0) normalized = lastComma > lastDot ? raw.replace(/\./g, "").replace(",", ".") : raw.replace(/,/g, "");
  else if (lastComma >= 0) normalized = raw.split(",").length > 2 || raw.split(",").at(-1).length === 3 ? raw.replace(/,/g, "") : raw.replace(",", ".");
  else if (lastDot >= 0) normalized = /^\d{1,3}(?:\.\d{3})+$/.test(raw) ? raw.replace(/\./g, "") : raw;
  const amount = Number(normalized);
  return Number.isFinite(amount) && amount >= 0 ? amount : null;
}

export function extractAmount(text) {
  const source = String(text ?? "").toLowerCase();
  const moneyMatches = [...source.matchAll(/(?:bs\.?|bob|usd|us\$|\$)\s*([\d.,]+)|([\d.,]+)\s*(?:bs\.?|bob|usd|us\$|\$)/gi)];
  if (moneyMatches.length) return parseLocalizedAmount(moneyMatches.at(-1)[1] || moneyMatches.at(-1)[2]);
  const modelNumber = source.match(/\b(?:iphone|ipad|galaxy|pixel|playstation|xbox|macbook|modelo|serie|ps)\s*(?:[a-z-]+\s*)?(\d{1,4})\b/i)?.[1];
  const candidates = [...source.matchAll(/\d+(?:[.,]\d+)?/g)].filter((match) => match[0] !== modelNumber);
  return candidates.length ? parseLocalizedAmount(candidates.at(-1)[0]) : null;
}

function includesAny(text, terms) {
  return terms.some((term) => text.includes(term));
}

export function answerQuestion(state, question, referenceDate = new Date()) {
  const q = String(question || "").toLowerCase().trim();
  const currency = state.profile?.currency || "BOB";
  const unit = currency === "USD" ? "USD" : "Bs";
  const cash = calculateAvailableMoney(state, referenceDate);
  const health = calculateFinancialHealth(state, referenceDate);
  const current = summarizePeriod(state, startOfMonth(referenceDate), referenceDate);
  const requestedGoal = (state.goals || []).find((goal) => q.includes(String(goal.name || "").toLowerCase()));

  if (includesAny(q, ["puedo comprar", "puedo permitirme"]) || (q.includes("comprar") && /\d/.test(q))) {
    const purchaseAmount = extractAmount(q);
    if (!purchaseAmount) return `Entendí que quieres evaluar una compra. Indícame el precio, por ejemplo: “¿Puedo comprarlo por ${unit} 500?”.`;
    const result = evaluatePurchase(state, purchaseAmount, referenceDate);
    const emoji = result.verdict === "si" ? "🟢" : result.verdict === "precaucion" ? "🟡" : result.verdict === "incomplete" ? "ℹ️" : "🔴";
    const missing = result.missing.length ? ` Falta completar: ${result.missing.join(", ")}.` : "";
    return `${emoji} ${result.label}. Disponible antes: ${fmtBs(result.availableBefore, currency)}; después: ${fmtBs(result.availableAfter, currency)}. ${result.explanation}${missing}`;
  }

  if (q.includes("ahorrar") || q.includes("capacidad de ahorro")) {
    const requestedAmount = extractAmount(q);
    if (!current.hasIncomeData || !current.hasExpenseData) return "Entendí que quieres evaluar tu ahorro. Necesito un ingreso real y un gasto real del mes para calcularlo con tus datos.";
    const capacity = Math.max(0, Math.min(current.balanceNeto, cash.available));
    if (requestedAmount !== null) {
      const remaining = cash.available - requestedAmount;
      const covered = requestedAmount <= capacity;
      return `${covered ? "Sí, de forma condicional" : "No por ahora"}. Para ahorrar ${fmtBs(requestedAmount, currency)} usaría un balance neto mensual de ${fmtBs(current.balanceNeto, currency)} y un disponible de ${fmtBs(cash.available, currency)}. Quedarían ${fmtBs(remaining, currency)} después del aporte; tus compromisos próximos suman ${fmtBs(cash.committed, currency)}.${health.available ? " La reserva y la deuda ya están incorporadas en tu evaluación financiera." : ` Falta completar: ${health.missing.join(", ")}.`}`;
    }
    return `Tu capacidad conservadora de ahorro este mes es ${fmtBs(Math.max(0, capacity), currency)}: balance neto ${fmtBs(current.balanceNeto, currency)} y disponible después de compromisos ${fmtBs(cash.available, currency)}.`;
  }

  if (includesAny(q, ["por qué gasté", "por que gaste", "gasté más", "gaste mas", "evolución", "evolucion"])) {
    const comparison = getMonthlyComparison(state, referenceDate);
    if (!comparison.available) return "Entendí que quieres comparar tu evolución. Necesito ingresos y gastos reales tanto este mes como en el mismo tramo del mes anterior.";
    const trends = getCategoryTrends(state, referenceDate).filter((trend) => trend.change !== null).sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
    if (!trends.length) return `Comparé ${comparison.current.start}–${comparison.current.end} con ${comparison.previous.start}–${comparison.previous.end}, pero aún no hay una categoría con base suficiente para explicar el cambio.`;
    const top = trends[0];
    return `${top.name} pasó de ${fmtBs(top.previous, currency)} a ${fmtBs(top.current, currency)} (${fmtPct(top.change)}). La comparación usa mes a la fecha contra los mismos días del mes anterior y tiene confianza ${comparison.confidence}.`;
  }

  if (q.includes("salud")) {
    if (!health.available) return `La Salud financiera aún no está disponible. Falta completar: ${health.missing.join(", ")}.`;
    const components = Object.entries(health.breakdown).map(([key, value]) => `${key}: ${value.score}%`).join(", ");
    return `Tu Salud financiera es ${health.score}% con confianza ${health.confidence}. Componentes: ${components}. ${health.resumen}`;
  }

  if (includesAny(q, ["proyección", "proyeccion", "cómo estaré", "como estare", "30 días", "fin de mes"])) {
    const mode = q.includes("fin de mes") ? "month_end" : "rolling_30";
    const projection = projectCashFlow(state, { mode, referenceDate });
    if (!projection.available) return `Entendí que quieres una proyección. Falta completar: ${projection.missing.join(", ")}.`;
    return `Del ${projection.startDate} al ${projection.endDate} (${projection.days} días), el saldo pasaría de ${fmtBs(projection.start, currency)} a ${fmtBs(projection.end, currency)}. Sumé ${fmtBs(projection.expectedIncome, currency)} de ingresos y resté ${fmtBs(projection.commitments + projection.expectedVariableExpenses, currency)}. Confianza: ${projection.confidence}.`;
  }

  if (q.includes("objetivo") || q.includes("meta") || requestedGoal) {
    const goal = requestedGoal || (state.goals || [])[0];
    if (!goal) return "Entendí que preguntas por un objetivo. Crea uno en Planes e indica monto y aporte mensual.";
    const estimate = estimateGoalCompletion(goal);
    if (estimate.months === null) return `“${goal.name}” no tiene un aporte mensual mayor a cero. Edítalo en Planes para calcular su fecha.`;
    return `Con ${fmtBs(goal.monthlyContribution, currency)} al mes, alcanzarías “${goal.name}” en ${estimate.months} meses. Para acelerarlo, aumenta el aporte mensual en el simulador de Planes.`;
  }

  if (q.includes("deuda") && includesAny(q, ["priorizar", "primero", "pagar"])) {
    const debts = [...(state.debts || []), ...(state.accounts || []).filter((account) => account.type === "tarjeta_credito" && Number(account.balance) < 0).map((account) => ({ name: account.name, balance: Math.abs(account.balance), rate: account.rate || 0 }))];
    const priority = debts.sort((a, b) => Number(b.rate) - Number(a.rate) || Number(b.balance) - Number(a.balance))[0];
    return priority ? `Prioriza “${priority.name}”: es la obligación con mayor costo conocido o mayor saldo. Revisa su tasa y pago mínimo en Planes o Cuentas.` : "No encuentro deudas registradas. Si tienes una tarjeta con saldo utilizado, completa sus datos en Cuentas.";
  }

  if (includesAny(q, ["disponible", "cuánto tengo", "cuanto tengo", "saldo real"])) return `Tienes ${fmtBs(cash.available, currency)} disponibles después de reservar ${fmtBs(cash.committed, currency)} para compromisos de los próximos 30 días.`;

  return "Entendí que buscas orientación financiera, pero necesito una consulta más concreta. Puedes preguntarme: “¿Cuánto tengo disponible?”, “¿Puedo ahorrar Bs 1.000?”, “Explícame mi Salud financiera” o “Proyección a fin de mes”.";
}
