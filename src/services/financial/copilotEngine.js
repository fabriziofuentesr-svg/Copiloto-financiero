// Motor de respuestas del Copiloto. Es una capa de reglas por
// palabras clave sobre los mismos datos financieros del usuario — no un
// chatbot genérico. Está aislado para poder sustituirlo después por una
// llamada real a la API de Claude sin tocar la UI del chat.
import { calculateAvailableMoney, calculateFinancialHealth, summarizeMonth, getCategoryTrends, projectBalance, hasFinancialData } from "./calculations.js";
import { evaluatePurchase } from "./purchaseAdvisor.js";
import { estimateGoalCompletion } from "./goals.js";
import { fmtBs, fmtPct } from "./format.js";

function extractAmount(text) {
  const match = text.replace(/[.,](?=\d{3}\b)/g, "").match(/(\d+(?:[.,]\d+)?)/);
  return match ? Number(match[1].replace(",", ".")) : null;
}

export function answerQuestion(state, question) {
  if (!hasFinancialData(state)) {
    return "Todavía no tengo datos financieros tuyos. Registra tus ingresos y gastos en Movimientos (o agrega una cuenta en Cuentas) y podré darte respuestas basadas en tu situación real.";
  }

  const q = question.toLowerCase();
  const { available } = calculateAvailableMoney(state);
  const health = calculateFinancialHealth(state);
  const { ingresos, gastos, ahorro } = summarizeMonth(state, "current");

  if (q.includes("puedo comprar") || q.includes("puedo permitirme") || (q.includes("comprar") && /\d/.test(q))) {
    const amount = extractAmount(q);
    if (!amount) {
      return "Decime el monto de la compra (por ejemplo: '¿puedo comprar algo de Bs 500?') y te digo si te conviene ahora.";
    }
    const veredicto = evaluatePurchase(state, amount);
    const emoji = veredicto.verdict === "si" ? "🟢" : veredicto.verdict === "precaucion" ? "🟡" : "🔴";
    return `${emoji} ${veredicto.label}. ${veredicto.explanation}`;
  }

  if (q.includes("cuánto puedo ahorrar") || q.includes("cuanto puedo ahorrar")) {
    return `A tu ritmo actual, este mes te quedarían aproximadamente ${fmtBs(ahorro)} después de tus gastos (ingresos ${fmtBs(ingresos)}, gastos ${fmtBs(gastos)}).`;
  }

  if (q.includes("por qué gasté") || q.includes("por que gaste") || q.includes("gasté más") || q.includes("gaste mas")) {
    const trends = getCategoryTrends(state).filter((t) => t.change > 0.15).sort((a, b) => b.change - a.change);
    if (trends.length === 0) return "No veo aumentos importantes este mes respecto al anterior. Tus gastos se mantienen parecidos.";
    const top = trends.slice(0, 2).map((t) => `${t.name.toLowerCase()} (${fmtPct(t.change)})`).join(" y ");
    return `El aumento se explica principalmente por ${top} frente al mes pasado.`;
  }

  if (q.includes("objetivo") || q.includes("meta")) {
    const goal = state.goals[0];
    if (!goal) return "Todavía no tienes objetivos creados. Puedes agregar uno desde la sección Planes.";
    const est = estimateGoalCompletion(goal);
    return `A tu ritmo actual (${fmtBs(goal.monthlyContribution)}/mes) alcanzarías "${goal.name}" en ${est.months} meses, alrededor de ${est.date?.toLocaleDateString("es-BO", { month: "long", year: "numeric" })}. Si aumentas el aporte mensual, llegas antes — puedes probarlo en el simulador de la meta.`;
  }

  if (q.includes("deuda") && (q.includes("priorizar") || q.includes("primero"))) {
    const worst = [...state.debts].sort((a, b) => b.rate - a.rate)[0];
    if (!worst) return "No tienes deudas registradas.";
    return `Prioriza "${worst.name}": tiene la tasa más alta (${worst.rate}% anual), así que es la que más te cuesta mantener con el tiempo.`;
  }

  if (q.includes("disponible") || q.includes("cuánto tengo") || q.includes("cuanto tengo")) {
    return `Hoy tienes ${fmtBs(available)} realmente disponibles, después de restar tus próximos compromisos de tu saldo total.`;
  }

  if (q.includes("6 meses") || q.includes("proyección") || q.includes("proyeccion") || q.includes("cómo estaré") || q.includes("como estare")) {
    const projection = projectBalance(state, 180);
    return `Proyectando tus ingresos y gastos actuales a 180 días, tu saldo estimado rondaría los ${fmtBs(projection.end)}. ${projection.atRisk ? "Ojo: en el camino hay un punto donde tu liquidez podría caer por debajo de cero." : "El camino se ve estable, sin caídas fuertes de liquidez en el medio."}`;
  }

  return `Tu salud financiera hoy es de ${health.score}/100 (${health.resumen}) Puedo ayudarte con preguntas como cuánto puedes gastar, si te conviene una compra, qué deuda priorizar o cómo va tu objetivo de ahorro.`;
}
