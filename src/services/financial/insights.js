import { calculateFinancialHealth, getCategoryTrends, getMonthlyComparison, getTotalDebtInstallments, projectCashFlow } from "./calculations.js";
import { estimateGoalCompletion, goalProgress } from "./goals.js";
import { fmtBs, fmtPct } from "./format.js";

export function generateInsights(state, referenceDate = new Date()) {
  const insights = [];
  const currency = state.profile?.currency || "BOB";
  const comparison = getMonthlyComparison(state, referenceDate);
  if (comparison.available) {
    getCategoryTrends(state, referenceDate).filter((item) => item.change !== null && Math.abs(item.change) >= 0.2).forEach((item) => {
      insights.push({ id: `trend-${item.categoryId}`, level: comparison.confidence === "baja" ? "warning" : item.change > 0 ? "warning" : "positive", title: `${item.name}: ${fmtPct(Math.abs(item.change))} ${item.change > 0 ? "más" : "menos"}`, detail: `${fmtBs(item.previous, currency)} frente a ${fmtBs(item.current, currency)} entre ${comparison.previous.start}–${comparison.previous.end} y ${comparison.current.start}–${comparison.current.end}. Confianza ${comparison.confidence}.` });
    });
    if (comparison.current.balanceNeto < comparison.previous.balanceNeto) insights.push({ id: "balance-neto-baja", level: "warning", title: "El balance neto del periodo disminuyó", detail: `Quedaron ${fmtBs(comparison.current.balanceNeto, currency)} frente a ${fmtBs(comparison.previous.balanceNeto, currency)} en periodos equivalentes. No incluye saldos iniciales ni ajustes.` });
  }

  const health = calculateFinancialHealth(state, referenceDate);
  if (health.available && health.dti > 0.35) insights.push({ id: "dti-alto", level: "danger", title: "Tus pagos de deuda son elevados", detail: `${fmtBs(getTotalDebtInstallments(state), currency)} al mes, equivalentes a ${fmtPct(health.dti)} del ingreso operativo.` });

  (state.goals || []).forEach((goal) => { const estimate = estimateGoalCompletion(goal); if (goalProgress(goal).progresoPct < 1 && estimate.months > 24) insights.push({ id: `goal-${goal.id}`, level: "warning", title: `El objetivo “${goal.name}” necesita más tiempo`, detail: `Con ${fmtBs(goal.monthlyContribution, currency)} al mes tardarías aproximadamente ${estimate.months} meses.` }); });

  const projection = projectCashFlow(state, { mode: "rolling_30", referenceDate });
  if (projection.available && projection.atRisk) insights.push({ id: "cash-risk", level: "danger", title: "Riesgo de liquidez en los próximos 30 días", detail: "La proyección cae por debajo de cero al incluir compromisos, deuda y gastos estimados." });

  if (!comparison.available) {
    const real = (state.transactions || []).filter((item) => item.origin === "user" && (item.type === "ingreso" || item.type === "gasto"));
    if (real.length) insights.push({ id: "low-sample", level: "warning", title: "Aún hay pocos datos para afirmar una tendencia", detail: `Hay ${real.length} ${real.length === 1 ? "movimiento real" : "movimientos reales"}. La comparación requiere ingresos y gastos en ambos periodos equivalentes.` });
  }
  const priority = { danger: 0, warning: 1, positive: 2 };
  return insights.sort((a, b) => priority[a.level] - priority[b.level]);
}

export function getMainInsight(state) { return generateInsights(state)[0] || { id: "keep-recording", level: "positive", title: "Registra datos reales para recibir insights", detail: "Los saldos iniciales explican tus cuentas, pero no cuentan como ingreso operativo." }; }
