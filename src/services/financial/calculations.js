// Cálculos financieros centrales. Funciones puras: reciben el estado
// financiero y devuelven números/objetos, sin tocar React ni el DOM.
import { addDays, isSameMonth, isPrevMonth, nextOccurrence, clamp } from "./format.js";
import { getComparableMonths, getFinancialDataReadiness } from "./readiness.js";

function addRecurringOccurrences(items, record, dayField, kind, today, horizon) {
  if (kind === "deuda" && (Number(record.balance) || 0) <= 0) return;
  let date = nextOccurrence(record[dayField], today);
  let occurrence = 0;
  while (date <= horizon && occurrence < 1200) {
    items.push({
      id: record.id,
      name: record.name,
      amount: Math.max(0, Number(record.amount ?? record.installment) || 0),
      date,
      kind,
    });
    occurrence += 1;
    date = nextOccurrence(record[dayField], new Date(date.getFullYear(), date.getMonth() + 1, 1));
  }
}

export function getUpcomingCommitments(state, days = 30, referenceDate = new Date()) {
  const today = new Date(referenceDate);
  const horizon = addDays(today, Math.max(0, Number(days) || 0));
  const items = [];

  (state.recurringExpenses || []).forEach((r) => {
    addRecurringOccurrences(items, r, "dayOfMonth", "gasto_fijo", today, horizon);
  });

  (state.debts || []).forEach((d) => {
    addRecurringOccurrences(items, d, "paymentDay", "deuda", today, horizon);
  });

  return items.sort((a, b) => a.date - b.date);
}

// Saldo total = solo cuentas que representan dinero propio disponible
// (se excluye la tarjeta de crédito: su saldo negativo es deuda, no activo).
export function getTotalBalance(state) {
  return (state.accounts || [])
    .filter((a) => a.type !== "tarjeta_credito")
    .reduce((sum, a) => sum + (Number(a.balance) || 0), 0);
}

// "Dinero realmente disponible": saldo total menos los compromisos que
// vencen en los próximos 30 días.
export function calculateAvailableMoney(state, referenceDate = new Date()) {
  const totalBalance = getTotalBalance(state);
  const committed = getUpcomingCommitments(state, 30, referenceDate).reduce((s, c) => s + c.amount, 0);
  return { totalBalance, committed, available: totalBalance - committed };
}

export function getMonthTransactions(state, ref = new Date(), which = "current") {
  return (state.transactions || []).filter((t) => {
    const inMonth = which === "current" ? isSameMonth(t.date, ref) : isPrevMonth(t.date, ref);
    return inMonth;
  });
}

export function summarizeMonth(state, which = "current") {
  const txs = getMonthTransactions(state, new Date(), which);
  const ingresos = txs.filter((t) => t.type === "ingreso").reduce((s, t) => s + (Number(t.amount) || 0), 0);
  const gastos = txs.filter((t) => t.type === "gasto").reduce((s, t) => s + (Number(t.amount) || 0), 0);
  return { ingresos, gastos, ahorro: ingresos - gastos };
}

export function summarizeByCategory(state, which = "current") {
  const txs = getMonthTransactions(state, new Date(), which).filter((t) => t.type === "gasto");
  const byCategory = {};
  txs.forEach((t) => {
    byCategory[t.category] = (byCategory[t.category] || 0) + (Number(t.amount) || 0);
  });
  return Object.entries(byCategory)
    .map(([categoryId, amount]) => {
      const cat = state.categories.find((c) => c.id === categoryId);
      return { categoryId, name: cat?.name || categoryId, color: cat?.color || "#8A8A8A", amount };
    })
    .sort((a, b) => b.amount - a.amount);
}

export function getCategoryTrends(state) {
  const comparable = getComparableMonths(state);
  if (!comparable || !comparable.current.hasExpenseData || !comparable.previous.hasExpenseData) return [];
  const summarizeKey = (key) => {
    const byCategory = {};
    (state.transactions || [])
      .filter((transaction) => transaction.type === "gasto" && String(transaction.date).slice(0, 7) === key)
      .forEach((transaction) => {
        byCategory[transaction.category] = (byCategory[transaction.category] || 0) + (Number(transaction.amount) || 0);
      });
    return Object.entries(byCategory).map(([categoryId, amount]) => ({ categoryId, amount }));
  };
  const current = summarizeKey(comparable.current.key);
  const previous = summarizeKey(comparable.previous.key);
  const ids = new Set([...current.map((c) => c.categoryId), ...previous.map((c) => c.categoryId)]);
  return Array.from(ids)
    .map((id) => {
      const cur = current.find((c) => c.categoryId === id)?.amount || 0;
      const prev = previous.find((c) => c.categoryId === id)?.amount || 0;
      const cat = state.categories.find((c) => c.id === id);
      const change = prev > 0 ? (cur - prev) / prev : cur > 0 ? 1 : 0;
      return { categoryId: id, name: cat?.name || id, current: cur, previous: prev, change };
    })
    .filter((c) => c.current > 0 || c.previous > 0)
    .sort((a, b) => b.current - a.current);
}

// Distingue a un usuario que ya empezó a alimentar la app (aunque sea con
// un solo movimiento o una sola cuenta) de uno recién configurado que
// todavía no tiene nada registrado. Se usa para decidir si Inicio muestra
// el resumen financiero o un estado vacío.
export function hasFinancialData(state) {
  return (
    (state.accounts || []).length > 0 ||
    (state.transactions || []).length > 0 ||
    (state.debts || []).length > 0 ||
    (state.goals || []).length > 0
  );
}

// Estado del fondo de emergencia, calculado a partir de los gastos
// esenciales reales del usuario. Se usa en Planes (a detalle) y en el
// resumen de Inicio (una línea), para no duplicar la fórmula en dos sitios.
export function getEmergencyFundStatus(state) {
  const configuredIds = state.financialSettings?.essentialCategoryIds || [];
  const essentialCategoryIds = configuredIds.length > 0
    ? configuredIds
    : (state.categories || []).filter((c) => c.essential).map((c) => c.id);
  const essentialMonthly = getMonthTransactions(state, new Date(), "current")
    .filter((t) => t.type === "gasto" && essentialCategoryIds.includes(t.category))
    .reduce((s, t) => s + (Number(t.amount) || 0), 0);

  const current = Math.max(0, Number(state.emergencyFund?.current) || 0);
  const monthsTarget = Math.max(1, Number(state.emergencyFund?.monthsTarget) || 3);
  const target = essentialMonthly * monthsTarget;
  const progresoPct = target > 0 ? Math.min(1, current / target) : 0;
  const faltante = Math.max(0, target - current);

  return { essentialMonthly, target, progresoPct, faltante, current, monthsTarget, hasExpenses: essentialMonthly > 0 };
}

export function getTotalDebtInstallments(state) {
  return (state.debts || [])
    .filter((d) => (Number(d.balance) || 0) > 0)
    .reduce((s, d) => s + (Number(d.installment) || 0), 0);
}

export function getTotalDebtBalance(state) {
  return (state.debts || []).reduce((s, d) => s + (Number(d.balance) || 0), 0);
}

// Proyección basada solo en datos configurados: saldo, ingresos esperados,
// gastos variables estimados y compromisos registrados.
export function projectBalance(state, days = 30, referenceDate = new Date()) {
  const readiness = getFinancialDataReadiness(state);
  const today = new Date(referenceDate);
  const totalBalance = getTotalBalance(state);
  const horizon = addDays(today, Math.max(0, Number(days) || 0));
  if (!readiness.canCalculateProjection) {
    return {
      available: false,
      missing: readiness.projectionMissing,
      start: totalBalance,
      end: null,
      timeline: [],
      minPoint: null,
      atRisk: null,
    };
  }

  const events = getUpcomingCommitments(state, days, today).map((c) => ({ ...c, delta: -c.amount }));
  const expectedIncome = Number(state.financialSettings?.projection?.expectedMonthlyIncome || state.profile?.estimatedMonthlyIncome);
  const expectedVariableExpenses = Number(state.financialSettings?.projection?.expectedVariableExpenses);
  const months = Math.max(1, Math.ceil(days / 30));
  for (let occurrence = 1; occurrence <= months; occurrence += 1) {
    const eventDate = addDays(today, Math.min(days, occurrence * 30));
    events.push({ id: `ingreso-esperado-${occurrence}`, name: "Ingresos esperados", amount: expectedIncome, date: eventDate, kind: "ingreso", delta: expectedIncome });
    if (expectedVariableExpenses > 0) {
      events.push({ id: `gastos-variables-${occurrence}`, name: "Gastos variables estimados", amount: expectedVariableExpenses, date: eventDate, kind: "gasto_variable", delta: -expectedVariableExpenses });
    }
  }

  events.sort((a, b) => a.date - b.date);

  // El saldo inicial es el total de cuentas. Cada compromiso aparece una sola
  // vez en la línea de tiempo, evitando descontarlo también antes de empezar.
  let running = totalBalance;
  const timeline = events.map((e) => {
    running += e.delta;
    return { ...e, balanceAfter: running };
  });

  const minPoint = timeline.reduce((min, e) => (e.balanceAfter < min ? e.balanceAfter : min), totalBalance);

  const commitments = events.filter((event) => event.delta < 0 && event.kind !== "gasto_variable").reduce((sum, event) => sum + Math.abs(event.delta), 0);
  return {
    available: true,
    missing: [],
    start: totalBalance,
    end: running,
    timeline,
    minPoint,
    atRisk: minPoint < 0,
    expectedIncome: expectedIncome * months,
    expectedVariableExpenses: expectedVariableExpenses * months,
    commitments,
  };
}

// --- Salud financiera --------------------------------------------------
export function calculateFinancialHealth(state) {
  const readiness = getFinancialDataReadiness(state);
  if (!readiness.canCalculateFinancialHealth) {
    return { available: false, score: null, breakdown: null, resumen: "Salud financiera aún no disponible", missing: readiness.healthMissing };
  }

  const { available } = calculateAvailableMoney(state);
  const { ingresos, gastos, key } = readiness.latestMonth;
  const cuotas = getTotalDebtInstallments(state);
  const settings = state.financialSettings;
  const margin = ingresos - gastos - cuotas;
  const tasaAhorro = margin / ingresos;
  const personalTargetRate = settings.savingsTargetType === "percentage"
    ? Number(settings.savingsTargetValue) / 100
    : Number(settings.savingsTargetValue) / ingresos;
  const flujoCaja = margin < 0 ? 0 : clamp((tasaAhorro / Math.max(personalTargetRate, 0.01)) * 100, 0, 100);
  const essentialIds = settings.essentialCategoryIds || [];
  const essentialMonthly = (state.transactions || [])
    .filter((transaction) => transaction.type === "gasto" && String(transaction.date).slice(0, 7) === key && essentialIds.includes(transaction.category))
    .reduce((sum, transaction) => sum + (Number(transaction.amount) || 0), 0);
  const liquidSavings = (state.accounts || []).filter((account) => account.type === "ahorro").reduce((sum, account) => sum + Math.max(0, Number(account.balance) || 0), 0) + Math.max(0, Number(state.emergencyFund?.current) || 0);
  const coverageMonths = essentialMonthly > 0 ? liquidSavings / essentialMonthly : 0;
  const resilience = clamp((coverageMonths / Math.max(1, Number(state.emergencyFund?.monthsTarget) || 1)) * 100, 0, 100);
  const dti = settings.debtStatus === "none" ? 0 : cuotas / ingresos;
  const endeudamiento = settings.debtStatus === "none" ? 100 : clamp(100 - dti * 200, 0, 100);
  const planningItems = [
    readiness.hasEssentialExpenses,
    readiness.hasSavingsGoal,
    readiness.hasEmergencyTarget,
    readiness.hasDebtConfiguration,
    (state.goals || []).length > 0,
    (state.recurringExpenses || []).length > 0 || (state.debts || []).length > 0,
  ];
  const planificacion = (planningItems.filter(Boolean).length / planningItems.length) * 100;

  const breakdown = {
    flujoCaja: Math.round(flujoCaja),
    reserva: Math.round(resilience),
    endeudamiento: Math.round(endeudamiento),
    planificacion: Math.round(planificacion),
  };
  const score = Math.round(Object.values(breakdown).reduce((sum, value) => sum + value, 0) / 4);

  let resumen = "Tu situación financiera es crítica: necesita atención inmediata.";
  if (score > 80) resumen = "Tu situación financiera es sólida. Estás en buena posición para avanzar hacia tus metas.";
  else if (score > 60) resumen = "Tu situación financiera es estable, pero tienes espacio claro para mejorar.";
  else if (score > 40) resumen = "Tu situación financiera es débil: hay riesgos que conviene atender pronto.";

  const lowest = Object.entries(breakdown).sort((a, b) => a[1] - b[1])[0];
  const labels = { flujoCaja: "flujo de caja", reserva: "reserva financiera", endeudamiento: "nivel de endeudamiento", planificacion: "planificación" };
  if (score <= 80) resumen += ` Tu principal oportunidad de mejora está en tu ${labels[lowest[0]]}.`;

  return { available: true, score, breakdown, resumen, dti, tasaAhorro, margin, coverageMonths, missing: [] };
}
