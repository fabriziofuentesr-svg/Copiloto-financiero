// Cálculos financieros centrales. Funciones puras: reciben el estado
// financiero y devuelven números/objetos, sin tocar React ni el DOM.
import { addDays, isSameMonth, isPrevMonth, nextOccurrence, clamp } from "./format.js";

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
  const current = summarizeByCategory(state, "current");
  const previous = summarizeByCategory(state, "previous");
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
  const essentialCategoryIds = (state.categories || []).filter((c) => c.essential).map((c) => c.id);
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

// Proyección simple a N días: parte del saldo actual, aplica cada compromiso
// que vence dentro del horizonte y suma los ingresos recurrentes esperados.
export function projectBalance(state, days = 30, referenceDate = new Date()) {
  const today = new Date(referenceDate);
  const totalBalance = getTotalBalance(state);
  const horizon = addDays(today, Math.max(0, Number(days) || 0));
  const events = getUpcomingCommitments(state, days, today).map((c) => ({ ...c, delta: -c.amount }));

  // Añade cada ingreso mensual que cae dentro del horizonte, no solo el
  // primero. Así una proyección de 180 días incluye todos sus cobros.
  if (state.profile?.incomeDay && Number(state.profile.estimatedMonthlyIncome) > 0) {
    let payDate = nextOccurrence(state.profile.incomeDay, today);
    let occurrence = 0;
    while (payDate <= horizon && occurrence < 1200) {
      events.push({
        id: "ingreso-esperado-" + occurrence,
        name: "Ingreso esperado",
        amount: Number(state.profile.estimatedMonthlyIncome),
        date: payDate,
        kind: "ingreso",
        delta: Number(state.profile.estimatedMonthlyIncome),
      });
      occurrence += 1;
      payDate = nextOccurrence(state.profile.incomeDay, new Date(payDate.getFullYear(), payDate.getMonth() + 1, 1));
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

  return { start: totalBalance, end: running, timeline, minPoint, atRisk: minPoint < 0 };
}

// --- Salud financiera --------------------------------------------------
// 0-100, con 5 componentes de 20 puntos cada uno, calculados de forma
// independiente de la UI. `calculateFinancialHealth()` es la función que
// pediste que existiera aparte de los componentes React.
export function calculateFinancialHealth(state) {
  const { totalBalance, committed, available } = calculateAvailableMoney(state);
  const { ingresos, gastos } = summarizeMonth(state, "current");
  const cuotas = getTotalDebtInstallments(state);
  const hasIncome = ingresos > 0;
  const dti = hasIncome ? cuotas / ingresos : null;
  const tasaAhorro = hasIncome ? (ingresos - gastos - cuotas) / ingresos : null;
  const gastoTotalMensual = gastos + cuotas;
  const liquidezDias = gastoTotalMensual > 0 ? (available / gastoTotalMensual) * 30 : 0;

  // Cada componente se calcula en su propia escala 0-100 (20% de peso cada
  // uno sobre el total, que es simplemente su promedio).
  const liquidez = clamp((available / Math.max(1, committed || totalBalance * 0.5)) * 100, 0, 100);
  // Sin ingresos registrados no se puede calificar ahorro, gastos o deuda
  // como excelentes. Usamos un valor neutro o de riesgo cuando hay deuda,
  // evitando recomendaciones engañosas por falta de datos.
  const ahorro = hasIncome ? clamp((tasaAhorro / 0.2) * 100, 0, 100) : 50;
  const gastosScore = hasIncome
    ? clamp(100 - clamp((gastos - ingresos * 0.5) / (ingresos * 0.5 || 1), 0, 1) * 100, 0, 100)
    : gastos > 0
      ? 0
      : 50;
  const endeudamiento = hasIncome
    ? dti <= 0.15
      ? 100
      : dti >= 0.5
        ? 0
        : clamp(100 * (1 - (dti - 0.15) / 0.35), 0, 100)
    : cuotas > 0
      ? 0
      : 50;
  const estabilidad = gastoTotalMensual > 0 ? clamp((liquidezDias / 30) * 100, 0, 100) : 50;

  const breakdown = {
    liquidez: Math.round(liquidez),
    ahorro: Math.round(ahorro),
    gastos: Math.round(gastosScore),
    endeudamiento: Math.round(endeudamiento),
    estabilidad: Math.round(estabilidad),
  };
  const score = Math.round(
    (breakdown.liquidez + breakdown.ahorro + breakdown.gastos + breakdown.endeudamiento + breakdown.estabilidad) / 5
  );

  let resumen = "Tu situación financiera es crítica: necesita atención inmediata.";
  if (score > 80) resumen = "Tu situación financiera es sólida. Estás en buena posición para avanzar hacia tus metas.";
  else if (score > 60) resumen = "Tu situación financiera es estable, pero tienes espacio claro para mejorar.";
  else if (score > 40) resumen = "Tu situación financiera es débil: hay riesgos que conviene atender pronto.";

  const lowest = Object.entries(breakdown).sort((a, b) => a[1] - b[1])[0];
  const labels = { liquidez: "liquidez", ahorro: "ahorro", gastos: "control de gastos", endeudamiento: "nivel de endeudamiento", estabilidad: "estabilidad financiera" };
  if (score <= 80) resumen += ` Tu principal oportunidad de mejora está en tu ${labels[lowest[0]]}.`;

  return { score, breakdown, resumen, dti, tasaAhorro, liquidezDias };
}

