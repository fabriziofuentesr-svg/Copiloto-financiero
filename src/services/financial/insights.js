// Motor de reglas para insights y alertas. Separado de la UI a propósito:
// cuando quieras reemplazar esto por un modelo real, solo cambia este
// archivo y todas las pantallas que lo consumen se actualizan solas.
import {
  calculateFinancialHealth,
  getCategoryTrends,
  getTotalDebtInstallments,
  projectBalance,
} from "./calculations.js";
import { getFinancialDataReadiness } from "./readiness.js";
import { estimateGoalCompletion, goalProgress } from "./goals.js";
import { fmtBs, fmtPct } from "./format.js";

export function generateInsights(state) {
  const insights = [];
  const currency = state.profile?.currency || "BOB";
  const readiness = getFinancialDataReadiness(state);
  const trends = getCategoryTrends(state);
  const cuotas = getTotalDebtInstallments(state);
  const health = calculateFinancialHealth(state);

  trends
    .filter((t) => Math.abs(t.change) >= 0.2 && t.previous > 0)
    .forEach((t) => {
      insights.push({
        id: `trend-${t.categoryId}`,
        level: t.change > 0 ? "warning" : "positive",
        title: `${t.name} ${t.change > 0 ? "aumentó" : "bajó"} ${fmtPct(Math.abs(t.change))}`,
        detail: `Pasaste de ${fmtBs(t.previous, currency)} a ${fmtBs(t.current, currency)} en ${t.name.toLowerCase()} respecto al mes anterior.`,
      });
    });

  const comparable = readiness.comparableMonths;
  if (comparable?.current.ahorro != null && comparable?.previous.ahorro != null && comparable.current.ahorro < comparable.previous.ahorro) {
    insights.push({
      id: "ahorro-baja",
      level: "warning",
      title: "Tu capacidad de ahorro disminuyó este mes",
      detail: `En el período más reciente te quedaron ${fmtBs(comparable.current.ahorro, currency)} después de gastos, frente a ${fmtBs(comparable.previous.ahorro, currency)} en el período anterior.`,
    });
  }

  if (health.available && health.dti > 0.35) {
    insights.push({
      id: "dti-alto",
      level: "danger",
      title: "Tus compromisos de deuda representan una proporción elevada de tus ingresos",
      detail: `Tus cuotas (${fmtBs(cuotas, currency)}) equivalen a ${fmtPct(health.dti)} de tu ingreso mensual.`,
    });
  }

  (state.goals || []).forEach((g) => {
    const est = estimateGoalCompletion(g);
    const { progresoPct } = goalProgress(g);
    if (progresoPct < 1 && est.months != null && est.months > 24) {
      insights.push({
        id: `meta-lenta-${g.id}`,
        level: "warning",
        title: `Al ritmo actual, tardarás en llegar a "${g.name}"`,
        detail: `Con un aporte de ${fmtBs(g.monthlyContribution, currency)} al mes, la alcanzarías en ${est.months} meses.`,
      });
    }
  });

  const projection = projectBalance(state, 30);
  if (projection.available && projection.atRisk) {
    insights.push({
      id: "riesgo-liquidez",
      level: "danger",
      title: "Riesgo de liquidez en los próximos 30 días",
      detail: "Tus obligaciones previstas podrían superar tu dinero disponible antes de tu próximo ingreso.",
    });
  }

  if (!readiness.canCompareMonths) {
    const current = readiness.latestMonth;
    const byCategory = {};
    (state.transactions || [])
      .filter((transaction) => transaction.type === "gasto" && String(transaction.date).slice(0, 7) === current?.key)
      .forEach((transaction) => { byCategory[transaction.category] = (byCategory[transaction.category] || 0) + (Number(transaction.amount) || 0); });
    const categories = Object.entries(byCategory)
      .map(([categoryId, amount]) => ({ name: state.categories?.find((category) => category.id === categoryId)?.name || categoryId, amount }))
      .sort((a, b) => b.amount - a.amount);
    if ((state.transactions || []).length > 0) {
      insights.push({
        id: "primeros-movimientos",
        level: "positive",
        title: "Ya registraste tus primeros movimientos",
        detail: current?.gastos > 0
          ? `Hasta ahora registraste ${fmtBs(current.gastos, currency)} en gastos este mes.`
          : "Sigue registrando ingresos y gastos para construir una visión más completa.",
      });
    }
    if (categories[0]) {
      insights.push({
        id: "categoria-principal-actual",
        level: "positive",
        title: `${categories[0].name} es tu mayor gasto hasta ahora`,
        detail: `Has registrado ${fmtBs(categories[0].amount, currency)} en esta categoría durante el mes actual.`,
      });
    }
    if (!readiness.hasIncomeData) {
      insights.push({
        id: "completar-ingresos",
        level: "warning",
        title: "Completa tus ingresos",
        detail: "Necesitamos tus ingresos para calcular tu margen mensual y capacidad de ahorro.",
      });
    }
  }

  const priority = { danger: 0, warning: 1, positive: 2 };
  return insights.sort((a, b) => priority[a.level] - priority[b.level]);
}

// El insight "principal" que se muestra destacado en el dashboard.
export function getMainInsight(state) {
  const insights = generateInsights(state);
  return insights[0] || {
    id: "sin-novedades",
    level: "positive",
    title: "Sigue completando tu información financiera",
    detail: "Cuantos más movimientos reales registres, más útiles serán los análisis del Copiloto.",
  };
}
