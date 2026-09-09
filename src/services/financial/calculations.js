// Cálculos financieros centrales. Funciones puras: reciben el estado
// financiero y devuelven números/objetos, sin tocar React ni el DOM.
import { addDays, isSameMonth, isPrevMonth, nextOccurrence, clamp } from "./format.js";

export function getUpcomingCommitments(state, days = 30) {
  const today = new Date();
  const horizon = addDays(today, days);
  const items = [];

  state.recurringExpenses.forEach((r) => {
    const date = nextOccurrence(r.dayOfMonth, today);
    if (date <= horizon) {
      items.push({ id: r.id, name: r.name, amount: r.amount, date, kind: "gasto_fijo" });
    }
  });

  state.debts.forEach((d) => {
    const date = nextOccurrence(d.paymentDay, today);
    if (date <= horizon) {
      items.push({ id: d.id, name: d.name, amount: d.installment, date, kind: "deuda" });
    }
  });

  return items.sort((a, b) => a.date - b.date);
}

// Saldo total = solo cuentas que representan dinero propio disponible
// (se excluye la tarjeta de crédito: su saldo negativo es deuda, no activo).
export function getTotalBalance(state) {
  return state.accounts
    .filter((a) => a.type !== "tarjeta_credito")
    .reduce((sum, a) => sum + a.balance, 0);
}

// "Dinero realmente disponible": saldo total menos los compromisos que
// vencen antes de que llegue el próximo ingreso (aproximado a 30 días).
export function calculateAvailableMoney(state) {
  const totalBalance = getTotalBalance(state);
  const committed = getUpcomingCommitments(state, 30).reduce((s, c) => s + c.amount, 0);
  return { totalBalance, committed, available: totalBalance - committed };
}

export function getMonthTransactions(state, ref = new Date(), which = "current") {
  return state.transactions.filter((t) => {
    const inMonth = which === "current" ? isSameMonth(t.date, ref) : isPrevMonth(t.date, ref);
    return inMonth;
  });
}

export function summarizeMonth(state, which = "current") {
  const txs = getMonthTransactions(state, new Date(), which);
  const ingresos = txs.filter((t) => t.type === "ingreso").reduce((s, t) => s + t.amount, 0);
  const gastos = txs.filter((t) => t.type === "gasto").reduce((s, t) => s + t.amount, 0);
  return { ingresos, gastos, ahorro: ingresos - gastos };
}

export function summarizeByCategory(state, which = "current") {
  const txs = getMonthTransactions(state, new Date(), which).filter((t) => t.type === "gasto");
  const byCategory = {};
  txs.forEach((t) => {
    byCategory[t.category] = (byCategory[t.category] || 0) + t.amount;
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
    state.accounts.length > 0 ||
    state.transactions.length > 0 ||
    state.debts.length > 0 ||
    state.goals.length > 0
  );
}

// Estado del fondo de emergencia, calculado a partir de los gastos
// esenciales reales del usuario. Se usa en Planes (a detalle) y en el
// resumen de Inicio (una línea), para no duplicar la fórmula en dos sitios.
export function getEmergencyFundStatus(state) {
  const essentialCategoryIds = state.categories.filter((c) => c.essential).map((c) => c.id);
  const essentialMonthly = getMonthTransactions(state, new Date(), "current")
    .filter((t) => t.type === "gasto" && essentialCategoryIds.includes(t.category))
    .reduce((s, t) => s + t.amount, 0);

  const target = essentialMonthly * state.emergencyFund.monthsTarget;
  const progresoPct = target > 0 ? Math.min(1, state.emergencyFund.current / target) : 0;
  const faltante = Math.max(0, target - state.emergencyFund.current);

  return { essentialMonthly, target, progresoPct, faltante };
}

export function getTotalDebtInstallments(state) {
  return state.debts.reduce((s, d) => s + d.installment, 0);
}

export function getTotalDebtBalance(state) {
  return state.debts.reduce((s, d) => s + d.balance, 0);
}

// Proyección simple a N días: saldo disponible menos los compromisos que
// vencen dentro de ese horizonte, sumando ingresos recurrentes esperados.
export function projectBalance(state, days = 30) {
  const { available } = calculateAvailableMoney(state);
  const today = new Date();
  const horizon = addDays(today, days);
  const events = getUpcomingCommitments(state, days).map((c) => ({ ...c, delta: -c.amount }));

  // Ingreso esperado si el día de pago cae dentro del horizonte (solo si el
  // usuario configuró día de ingreso e ingreso mensual estimado).
  if (state.profile.incomeDay && state.profile.estimatedMonthlyIncome > 0) {
    const payDate = nextOccurrence(state.profile.incomeDay, today);
    if (payDate <= horizon) {
      events.push({
        id: "ingreso-esperado",
        name: "Ingreso esperado",
        amount: state.profile.estimatedMonthlyIncome,
        date: payDate,
        kind: "ingreso",
        delta: state.profile.estimatedMonthlyIncome,
      });
    }
  }

  events.sort((a, b) => a.date - b.date);

  let running = available;
  const timeline = events.map((e) => {
    running += e.delta;
    return { ...e, balanceAfter: running };
  });

  const minPoint = timeline.reduce((min, e) => (e.balanceAfter < min ? e.balanceAfter : min), available);

  return { start: available, end: running, timeline, minPoint, atRisk: minPoint < 0 };
}

// --- Salud financiera --------------------------------------------------
// 0-100, con 5 componentes de 20 puntos cada uno, calculados de forma
// independiente de la UI. `calculateFinancialHealth()` es la función que
// pediste que existiera aparte de los componentes React.
export function calculateFinancialHealth(state) {
  const { totalBalance, committed, available } = calculateAvailableMoney(state);
  const { ingresos, gastos } = summarizeMonth(state, "current");
  const cuotas = getTotalDebtInstallments(state);
  const dti = ingresos > 0 ? cuotas / ingresos : 0;
  const tasaAhorro = ingresos > 0 ? (ingresos - gastos - cuotas) / ingresos : 0;
  const gastoTotalMensual = gastos + cuotas;
  const liquidezDias = gastoTotalMensual > 0 ? (available / gastoTotalMensual) * 30 : 0;

  // Cada componente se calcula en su propia escala 0-100 (20% de peso cada
  // uno sobre el total, que es simplemente su promedio).
  const liquidez = clamp((available / Math.max(1, committed || totalBalance * 0.5)) * 100, 0, 100);
  const ahorro = clamp((tasaAhorro / 0.2) * 100, 0, 100);
  const gastosScore = clamp(100 - clamp((gastos - ingresos * 0.5) / (ingresos * 0.5 || 1), 0, 1) * 100, 0, 100);
  const endeudamiento = dti <= 0.15 ? 100 : dti >= 0.5 ? 0 : clamp(100 * (1 - (dti - 0.15) / 0.35), 0, 100);
  const estabilidad = clamp((liquidezDias / 30) * 100, 0, 100);

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
