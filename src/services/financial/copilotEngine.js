// Motor de respuestas del Copiloto. Es una capa de reglas por
// palabras clave sobre los mismos datos financieros del usuario — no un
// chatbot genérico. Está aislado para poder sustituirlo después por una
// llamada real a la API de Claude sin tocar la UI del chat.
import { calculateAvailableMoney, calculateFinancialHealth, getCategoryTrends, projectBalance, hasFinancialData } from "./calculations.js";
import { getFinancialDataReadiness } from "./readiness.js";
import { evaluatePurchase } from "./purchaseAdvisor.js";
import { estimateGoalCompletion } from "./goals.js";
import { fmtBs, fmtPct } from "./format.js";

export function parseLocalizedAmount(value) {
  const raw = String(value ?? "").replace(/\s/g, "");
  if (!raw) return null;

  let normalized = raw;
  const lastComma = raw.lastIndexOf(",");
  const lastDot = raw.lastIndexOf(".");
  if (lastComma >= 0 && lastDot >= 0) {
    // El separador que aparece al final suele ser el decimal.
    if (lastComma > lastDot) normalized = raw.replace(/\./g, "").replace(",", ".");
    else normalized = raw.replace(/,/g, "");
  } else if (lastComma >= 0) {
    const parts = raw.split(",");
    normalized = parts.length > 2 || parts[parts.length - 1].length === 3
      ? raw.replace(/,/g, "")
      : raw.replace(",", ".");
  } else if (lastDot >= 0) {
    normalized = /^\d{1,3}(?:\.\d{3})+$/.test(raw) ? raw.replace(/\./g, "") : raw;
  }

  const amount = Number(normalized);
  return Number.isFinite(amount) && amount >= 0 ? amount : null;
}

// Prioriza importes asociados a una moneda o a palabras de precio. Así
// "iPhone 14 de Bs 8000" usa 8000 y no el número del modelo.
export function extractAmount(text) {
  const source = String(text ?? "").toLowerCase();
  const moneyPattern = /(?:bs\.?|bob|usd|us\$|\$)\s*([\d.,]+)|([\d.,]+)\s*(?:bs\.?|bob|usd|us\$|\$)/gi;
  const moneyMatches = [...source.matchAll(moneyPattern)];
  if (moneyMatches.length > 0) {
    const raw = moneyMatches[moneyMatches.length - 1][1] || moneyMatches[moneyMatches.length - 1][2];
    return parseLocalizedAmount(raw);
  }

  const numberMatches = [...source.matchAll(/\d+(?:[.,]\d+)?/g)];
  const modelPattern = /\b(?:iphone|ipod|ipad|galaxy|pixel|redmi|xiaomi|playstation|xbox|macbook|matebook|surface|modelo|serie|ps)\s*(?:[a-z-]+\s*)?(\d{1,4})\b/i;
  const modelNumber = source.match(modelPattern)?.[1];
  const candidates = numberMatches.filter((match) => match[0] !== modelNumber);
  if (candidates.length === 0) return null;
  return parseLocalizedAmount(candidates[candidates.length - 1][0]);
}

export function answerQuestion(state, question) {
  if (!hasFinancialData(state)) {
    return "Todavía no tengo datos financieros tuyos. Registra tus ingresos y gastos en Movimientos (o agrega una cuenta en Cuentas) y podré darte respuestas basadas en tu situación real.";
  }

  const q = question.toLowerCase();
  const currency = state.profile?.currency || "BOB";
  const unit = currency === "USD" ? "USD" : "Bs";
  const { available } = calculateAvailableMoney(state);
  const health = calculateFinancialHealth(state);
  const readiness = getFinancialDataReadiness(state);
  const { ingresos = 0, gastos = 0, ahorro = null } = readiness.latestMonth || {};
  const requestedGoal = (state.goals || []).find((item) => q.includes(String(item.name || "").toLowerCase()));

  if (q.includes("puedo comprar") || q.includes("puedo permitirme") || (q.includes("comprar") && /\d/.test(q))) {
    const amount = extractAmount(q);
    if (!amount) {
      return "Decime el monto de la compra (por ejemplo: '¿puedo comprar algo de " + unit + " 500?') y te digo si te conviene ahora.";
    }
    const veredicto = evaluatePurchase(state, amount);
    const emoji = veredicto.verdict === "si" ? "🟢" : veredicto.verdict === "precaucion" ? "🟡" : "🔴";
    return `${emoji} ${veredicto.label}. ${veredicto.explanation}`;
  }

  if (q.includes("cuánto puedo ahorrar") || q.includes("cuanto puedo ahorrar")) {
    if (ahorro === null) return "Necesito al menos un ingreso y un gasto reales del mismo mes para estimar cuánto podrías ahorrar.";
    return `A tu ritmo actual, este mes te quedarían aproximadamente ${fmtBs(ahorro, currency)} después de tus gastos (ingresos ${fmtBs(ingresos, currency)}, gastos ${fmtBs(gastos, currency)}).`;
  }

  if (q.includes("por qué gasté") || q.includes("por que gaste") || q.includes("gasté más") || q.includes("gaste mas")) {
    if (!readiness.canCompareMonths) return "Necesito ingresos y gastos reales de al menos dos meses distintos para explicar cambios entre períodos.";
    const trends = getCategoryTrends(state).filter((t) => t.change > 0.15).sort((a, b) => b.change - a.change);
    if (trends.length === 0) return "No veo aumentos importantes este mes respecto al anterior. Tus gastos se mantienen parecidos.";
    const top = trends.slice(0, 2).map((t) => `${t.name.toLowerCase()} (${fmtPct(t.change)})`).join(" y ");
    return `El aumento se explica principalmente por ${top} frente al mes pasado.`;
  }

  if (q.includes("objetivo") || q.includes("meta") || requestedGoal) {
    const goal = requestedGoal || (state.goals || [])[0];
    if (!goal) return "Todavía no tienes objetivos creados. Puedes agregar uno desde la sección Planes.";
    const est = estimateGoalCompletion(goal);
    if (est.months === null) {
      return "Tu objetivo \"" + goal.name + "\" todavía no tiene un aporte mensual. Define un aporte mayor a cero en Planes para calcular cuándo lo alcanzarías.";
    }
    return `A tu ritmo actual (${fmtBs(goal.monthlyContribution, currency)}/mes) alcanzarías "${goal.name}" en ${est.months} meses, alrededor de ${est.date?.toLocaleDateString("es-BO", { month: "long", year: "numeric" })}. Si aumentas el aporte mensual, llegas antes — puedes probarlo en el simulador de la meta.`;
  }

  if (q.includes("deuda") && (q.includes("priorizar") || q.includes("primero"))) {
    const worst = [...(state.debts || [])].sort((a, b) => b.rate - a.rate)[0];
    if (!worst) return "No tienes deudas registradas.";
    return `Prioriza "${worst.name}": tiene la tasa más alta (${worst.rate}% anual), así que es la que más te cuesta mantener con el tiempo.`;
  }

  if (q.includes("disponible") || q.includes("cuánto tengo") || q.includes("cuanto tengo")) {
    return `Hoy tienes ${fmtBs(available, currency)} realmente disponibles, después de restar tus próximos compromisos de tu saldo total.`;
  }

  if (q.includes("6 meses") || q.includes("proyección") || q.includes("proyeccion") || q.includes("cómo estaré") || q.includes("como estare")) {
    const projection = projectBalance(state, 180);
    if (!projection.available) return `La proyección aún no está disponible. Completa ${projection.missing.join(", ")} desde Análisis para calcularla.`;
    return `Proyectando tus ingresos y gastos actuales a 180 días, tu saldo estimado rondaría los ${fmtBs(projection.end, currency)}. ${projection.atRisk ? "Ojo: en el camino hay un punto donde tu liquidez podría caer por debajo de cero." : "El camino se ve estable, sin caídas fuertes de liquidez en el medio."}`;
  }

  if (!health.available) return `Tu salud financiera aún no está disponible. Completa ${health.missing.join(", ")} desde Análisis. Mientras tanto, puedo decirte cuánto dinero tienes disponible o ayudarte con tus objetivos.`;
  return `Tu salud financiera hoy es de ${health.score}% (${health.resumen}) Puedo ayudarte con preguntas como cuánto puedes gastar, si te conviene una compra, qué deuda priorizar o cómo va tu objetivo de ahorro.`;
}
