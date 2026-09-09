// Motor de reglas para insights y alertas. Separado de la UI a propósito:
// cuando quieras reemplazar esto por un modelo real, solo cambia este
// archivo y todas las pantallas que lo consumen se actualizan solas.
import {
  calculateFinancialHealth,
  calculateAvailableMoney,
  summarizeMonth,
  getCategoryTrends,
  getTotalDebtInstallments,
  projectBalance,
} from "./calculations.js";
import { estimateGoalCompletion, goalProgress } from "./goals.js";
import { fmtBs, fmtPct } from "./format.js";

export function generateInsights(state) {
  const insights = [];
  const trends = getCategoryTrends(state);
  const { ingresos } = summarizeMonth(state, "current");
  const { ingresos: ingresosPrev } = summarizeMonth(state, "previous");
  const cuotas = getTotalDebtInstallments(state);
  const { available } = calculateAvailableMoney(state);
  const health = calculateFinancialHealth(state);

  trends
    .filter((t) => Math.abs(t.change) >= 0.2 && t.previous > 0)
    .forEach((t) => {
      insights.push({
        id: `trend-${t.categoryId}`,
        level: t.change > 0 ? "warning" : "positive",
        title: `${t.name} ${t.change > 0 ? "aumentó" : "bajó"} ${fmtPct(Math.abs(t.change))}`,
        detail: `Pasaste de ${fmtBs(t.previous)} a ${fmtBs(t.current)} en ${t.name.toLowerCase()} respecto al mes anterior.`,
      });
    });

  const ahorroActual = summarizeMonth(state, "current").ahorro;
  const ahorroPrev = summarizeMonth(state, "previous").ahorro;
  if (ahorroActual < ahorroPrev) {
    insights.push({
      id: "ahorro-baja",
      level: "warning",
      title: "Tu capacidad de ahorro disminuyó este mes",
      detail: `Este mes te quedan ${fmtBs(ahorroActual)} después de gastos, frente a ${fmtBs(ahorroPrev)} el mes pasado.`,
    });
  }

  if (health.dti > 0.35) {
    insights.push({
      id: "dti-alto",
      level: "danger",
      title: "Tus compromisos de deuda representan una proporción elevada de tus ingresos",
      detail: `Tus cuotas (${fmtBs(cuotas)}) equivalen a ${fmtPct(health.dti)} de tu ingreso mensual.`,
    });
  }

  if (available > 0 && health.liquidezDias > 20) {
    insights.push({
      id: "liquidez-sana",
      level: "positive",
      title: "Tu liquidez actual es saludable",
      detail: `Con lo que tienes disponible hoy podrías cubrir tus gastos habituales por más de ${Math.round(health.liquidezDias)} días.`,
    });
  }

  state.goals.forEach((g) => {
    const est = estimateGoalCompletion(g);
    const { progresoPct } = goalProgress(g);
    if (progresoPct < 1 && est.months !== Infinity && est.months > 24) {
      insights.push({
        id: `meta-lenta-${g.id}`,
        level: "warning",
        title: `Al ritmo actual, tardarás en llegar a "${g.name}"`,
        detail: `Con un aporte de ${fmtBs(g.monthlyContribution)} al mes, la alcanzarías en ${est.months} meses.`,
      });
    }
  });

  const projection = projectBalance(state, 30);
  if (projection.atRisk) {
    insights.push({
      id: "riesgo-liquidez",
      level: "danger",
      title: "Riesgo de liquidez en los próximos 30 días",
      detail: "Tus obligaciones previstas podrían superar tu dinero disponible antes de tu próximo ingreso.",
    });
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
    title: "No hay novedades importantes este mes",
    detail: "Sigue registrando tus movimientos para que el copiloto pueda encontrar patrones.",
  };
}
