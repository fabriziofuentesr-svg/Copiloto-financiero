// Reglas financieras puras y deterministas. Los movimientos con origen
// initial_balance, balance_adjustment o internal_transfer explican el libro,
// pero nunca se tratan como actividad operativa del mes.
import { addDays, addMonths, clamp, daysBetweenInclusive, endOfMonth, localDateString, nextOccurrence, parseDate, startOfMonth } from "./format.js";
import { isAssetAccount, isOperatingTransaction, isRealUserTransaction } from "./ledger.js";
import { profileToday } from "./movementDates.js";
import { actualMonth, actualFinancialHealth } from "./actualMonth.js";
import { monthlyPlanStatus, monthlyHealth, monthKey as planMonthKey, spendingMoney } from "./monthlyPlan.js";

function amount(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function dateOnly(value) {
  const date = parseDate(value);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function inPeriod(value, start, end) {
  const date = dateOnly(value);
  return date >= dateOnly(start) && date <= dateOnly(end);
}

function monthKey(value) {
  const date = parseDate(value);
  if (Number.isNaN(date.getTime())) return null;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function getOperationalTransactions(state, start, end) {
  return (state.transactions || []).filter((transaction) => isOperatingTransaction(transaction) && transaction.date <= profileToday(state.profile) && inPeriod(transaction.date, start, end));
}

export function summarizePeriod(state, start, end) {
  const transactions = getOperationalTransactions(state, start, end);
  const incomes = transactions.filter((transaction) => transaction.type === "ingreso");
  const expenses = transactions.filter((transaction) => transaction.type === "gasto");
  const ingresos = amount(incomes.reduce((sum, transaction) => sum + amount(transaction.amount), 0));
  const gastos = amount(expenses.reduce((sum, transaction) => sum + amount(transaction.amount), 0));
  return {
    start: localDateString(start),
    end: localDateString(end),
    ingresos,
    gastos,
    balanceNeto: amount(ingresos - gastos),
    transactionCount: transactions.length,
    incomeCount: incomes.length,
    expenseCount: expenses.length,
    hasIncomeData: incomes.length > 0,
    hasExpenseData: expenses.length > 0,
  };
}

export function getMonthTransactions(state, ref = new Date(), which = "current", { operationalOnly = false } = {}) {
  const month = which === "current" ? startOfMonth(ref) : addMonths(startOfMonth(ref), -1);
  const start = startOfMonth(month);
  const end = endOfMonth(month);
  return (state.transactions || []).filter((transaction) => inPeriod(transaction.date, start, end) && (!operationalOnly || (isOperatingTransaction(transaction) && transaction.date <= profileToday(state.profile))));
}

export function summarizeMonth(state, which = "current", referenceDate = new Date()) {
  const month = which === "current" ? referenceDate : addMonths(referenceDate, -1);
  return summarizePeriod(state, startOfMonth(month), endOfMonth(month));
}

export function getMonthlyComparison(state, referenceDate = new Date()) {
  const today = dateOnly(referenceDate);
  const currentStart = startOfMonth(today);
  const previousStart = addMonths(currentStart, -1);
  const partial = today.getDate() < endOfMonth(today).getDate();
  const previousEnd = partial
    ? new Date(previousStart.getFullYear(), previousStart.getMonth(), Math.min(today.getDate(), endOfMonth(previousStart).getDate()))
    : endOfMonth(previousStart);
  const current = summarizePeriod(state, currentStart, today);
  const previous = summarizePeriod(state, previousStart, previousEnd);
  const comparable = current.hasIncomeData && current.hasExpenseData && previous.hasIncomeData && previous.hasExpenseData;
  const minSamples = Math.min(current.transactionCount, previous.transactionCount);
  return {
    available: comparable,
    type: partial ? "month_to_date" : "full_month",
    partial,
    current,
    previous,
    confidence: !comparable ? "insuficiente" : minSamples < 4 ? "baja" : "media",
    label: partial ? "Mes a la fecha vs. mismo día del mes anterior" : "Mes cerrado vs. mes anterior completo",
  };
}

export function summarizeByCategory(state, which = "current", referenceDate = new Date()) {
  const transactions = getMonthTransactions(state, referenceDate, which, { operationalOnly: true }).filter((transaction) => transaction.type === "gasto");
  const byCategory = {};
  transactions.forEach((transaction) => { byCategory[transaction.category] = amount((byCategory[transaction.category] || 0) + amount(transaction.amount)); });
  return Object.entries(byCategory).map(([categoryId, categoryAmount]) => {
    const category = (state.categories || []).find((item) => item.id === categoryId);
    return { categoryId, name: transactions.find(tx=>tx.category === categoryId)?.categorySnapshot?.name || category?.name || categoryId, color: category?.color || "#8A8A8A", amount: categoryAmount };
  }).sort((a, b) => b.amount - a.amount);
}

function categorySummary(state, start, end) {
  const result = {};
  getOperationalTransactions(state, start, end).filter((transaction) => transaction.type === "gasto").forEach((transaction) => {
    result[transaction.category] = amount((result[transaction.category] || 0) + amount(transaction.amount));
  });
  return result;
}

export function getCategoryTrends(state, referenceDate = new Date()) {
  const comparison = getMonthlyComparison(state, referenceDate);
  if (!comparison.available || comparison.confidence === "insuficiente") return [];
  const current = categorySummary(state, comparison.current.start, comparison.current.end);
  const previous = categorySummary(state, comparison.previous.start, comparison.previous.end);
  return [...new Set([...Object.keys(current), ...Object.keys(previous)])].map((categoryId) => {
    const currentAmount = current[categoryId] || 0;
    const previousAmount = previous[categoryId] || 0;
    const category = (state.categories || []).find((item) => item.id === categoryId);
    return {
      categoryId,
      name: category?.name || categoryId,
      current: currentAmount,
      previous: previousAmount,
      change: previousAmount > 0 ? (currentAmount - previousAmount) / previousAmount : null,
      confidence: comparison.confidence,
    };
  }).filter((item) => item.current > 0 || item.previous > 0).sort((a, b) => b.current - a.current);
}

export function getSavingsRealized(state, start = startOfMonth(new Date()), end = new Date()) {
  return amount((state.savingsContributions || []).filter((item) => !["reconcile","reassign"].includes(item.method) && inPeriod(item.date, start, end)).reduce((sum, item) => sum + (item.method === "release" ? -1 : 1) * amount(item.amount), 0));
}

export function getTotalBalance(state) {
  return amount((state.accounts || []).filter(isAssetAccount).reduce((sum, account) => sum + amount(account.balance), 0));
}

export function getCreditCardDebt(state) {
  return amount((state.accounts || []).filter((account) => account.type === "tarjeta_credito").reduce((sum, account) => sum + Math.abs(Math.min(0, amount(account.balance))), 0));
}

function linkedCardIds(state) {
  return new Set((state.accounts || []).filter((account) => account.type === "tarjeta_credito").map((account) => account.id));
}

export function getManualDebts(state) {
  const cardIds = linkedCardIds(state);
  const cardNames = new Set((state.accounts || []).filter((account) => account.type === "tarjeta_credito").map((account) => String(account.name || "").trim().toLocaleLowerCase("es")));
  return (state.debts || []).filter((debt) => {
    if (debt.linkedAccountId && cardIds.has(debt.linkedAccountId)) return false;
    return !cardNames.has(String(debt.name || "").trim().toLocaleLowerCase("es"));
  });
}

export function getTotalDebtInstallments(state) {
  const manual = getManualDebts(state).filter((debt) => amount(debt.balance) > 0).reduce((sum, debt) => sum + amount(debt.installment), 0);
  const cards = (state.accounts || []).filter((account) => account.type === "tarjeta_credito" && amount(account.balance) < 0).reduce((sum, account) => sum + amount(account.minimumPayment), 0);
  return amount(manual + cards);
}

export function getTotalDebtBalance(state) {
  return amount(getManualDebts(state).reduce((sum, debt) => sum + Math.max(0, amount(debt.balance)), 0) + getCreditCardDebt(state));
}

function addMonthlyOccurrences(items, record, kind, start, end) {
  if (record.active === false || amount(record.amount ?? record.installment ?? record.minimumPayment) <= 0) return;
  const day = record.dayOfMonth ?? record.paymentDay;
  let occurrence = record.nextDate ? dateOnly(record.nextDate) : day ? nextOccurrence(day, start) : null;
  if (!occurrence || Number.isNaN(occurrence.getTime())) return;
  const frequency = record.frequency || "mensual";
  const anchor = day || occurrence.getDate();
  const advance = (date) => {
    if(frequency === "semanal") return addDays(date,7);
    if(frequency === "quincenal") return addDays(date,14);
    return new Date(date.getFullYear(),date.getMonth()+1,Math.min(anchor,new Date(date.getFullYear(),date.getMonth()+2,0).getDate()));
  };
  while (occurrence < dateOnly(start)) occurrence = advance(occurrence);
  let guard = 0;
  while (occurrence <= dateOnly(end) && guard < 120) {
    const alreadyRecorded = (record.kind === "ingreso" || kind === "ingreso") && (record.stateTransactions || []).some((transaction) => {
      if (transaction.recurringId !== record.id || transaction.type !== "ingreso") return false;
      return frequency === "mensual" ? monthKey(transaction.date) === monthKey(occurrence) : localDateString(transaction.date) === localDateString(occurrence);
    });
    if (!alreadyRecorded) {
      const occurrenceAmount = amount(record.amount ?? record.installment ?? record.minimumPayment);
      items.push({ id: `${record.id}-${localDateString(occurrence)}`, sourceId: record.id, name: record.name, amount: occurrenceAmount, date: occurrence, kind, delta: kind === "ingreso" ? occurrenceAmount : -occurrenceAmount });
    }
    occurrence = advance(occurrence);
    guard += 1;
  }
}

export function getUpcomingCommitments(state, days = 30, referenceDate = new Date(), explicitEnd = null) {
  const start = dateOnly(referenceDate);
  const duration = Math.max(1, Number(days) || 30);
  const end = explicitEnd ? dateOnly(explicitEnd) : addDays(start, duration - 1);
  const items = [];
  (state.recurringExpenses || []).forEach((item) => addMonthlyOccurrences(items, item, "gasto_recurrente", start, end));
  getManualDebts(state).filter((debt) => amount(debt.balance) > 0).forEach((debt) => addMonthlyOccurrences(items, debt, "deuda", start, end));
  (state.accounts || []).filter((account) => account.type === "tarjeta_credito" && amount(account.balance) < 0).forEach((account) => addMonthlyOccurrences(items, { ...account, id: account.id, name: `Pago mínimo — ${account.name}`, amount: account.minimumPayment }, "tarjeta", start, end));
  (state.goals || []).filter((goal) => amount(goal.monthlyContribution) > 0 && amount(goal.current) < amount(goal.target)).forEach((goal) => addMonthlyOccurrences(items, { ...goal, frequency:goal.contributionFrequency || "mensual", nextDate:goal.contributionFrequency === "semanal" ? goal.nextContributionDate || localDateString(start) : goal.nextContributionDate, dayOfMonth: goal.contributionDay || 28, amount: goal.monthlyContribution, name: `Aporte — ${goal.name}` }, "objetivo", start, end));
  return items.sort((a, b) => a.date - b.date);
}

export function calculateAvailableMoney(state, referenceDate = new Date()) {
  const plan = monthlyPlanStatus(state, planMonthKey(referenceDate), referenceDate);
  if (plan.plan) return {totalBalance:plan.cash.total,savings:plan.cash.savings,protectedMoney:plan.cash.protectedMoney,committed:amount(plan.fixedPending+plan.debtPending+plan.overduePending),available:plan.availableToday,commitments:[...plan.expenses.filter(item=>item.classification === "fijo" && item.pending>0),...plan.overdue].map(item=>({...item,amount:item.pending,date:parseDate(plan.endDate)}))};
  const cash = actualMonth(state,planMonthKey(referenceDate),referenceDate).cash;
  const totalBalance = cash.total;
  const commitments = getUpcomingCommitments(state, 30, referenceDate);
  const committed = amount(commitments.reduce((sum, item) => sum + item.amount, 0));
  return { totalBalance, savings:cash.savings,protectedMoney:cash.protectedMoney,committed, available: amount(cash.spendable - committed), commitments };
}

export function getEmergencyFundStatus(state, referenceDate = new Date()) {
  if((state.monthlyPlans || []).some(plan=>plan.month === planMonthKey(referenceDate))) {
    const health=monthlyHealth(state,planMonthKey(referenceDate),referenceDate);
    const monthsTarget=Math.max(1,state.emergencyFund?.monthsTarget || 3);
    const target=amount(health.essentialMonthly*monthsTarget);
    return {known:health.breakdown.reserva.score !== null,essentialMonthly:health.essentialMonthly,current:health.reserve,monthsTarget,target,progresoPct:target>0 ? Math.min(1,health.reserve/target) : 0,faltante:Math.max(0,target-health.reserve),hasExpenses:health.essentialMonthly>0};
  }
  const configuredIds = state.financialSettings?.essentialCategoryIds || [];
  const essentialIds = configuredIds.length ? configuredIds : (state.categories || []).filter((category) => category.essential).map((category) => category.id);
  const summaryStart = startOfMonth(referenceDate);
  const essentialMonthly = amount(getOperationalTransactions(state, summaryStart, endOfMonth(referenceDate))
    .filter((transaction) => transaction.type === "gasto" && essentialIds.includes(transaction.category))
    .reduce((sum, transaction) => sum + amount(transaction.amount), 0));
  const current = Math.max(0, amount(state.emergencyFund?.current));
  const monthsTarget = Math.max(1, Number(state.emergencyFund?.monthsTarget) || 3);
  const target = amount(essentialMonthly * monthsTarget);
  return { known: Boolean(state.emergencyFund?.configured || current > 0), essentialMonthly, target, progresoPct: target > 0 ? Math.min(1, current / target) : 0, faltante: Math.max(0, amount(target - current)), current, monthsTarget, hasExpenses: essentialMonthly > 0 };
}

function projectionRange(mode, referenceDate, days) {
  const start = dateOnly(referenceDate);
  if (mode === "month_end") return { start, end: endOfMonth(start), mode };
  return { start, end: addDays(start, Math.max(1, Number(days) || 30) - 1), mode: mode || "rolling_30" };
}

export function projectCashFlow(state, { mode = "rolling_30", days = 30, referenceDate = new Date() } = {}) {
  if (mode === "month_end" && (state.monthlyPlans || []).some(plan=>plan.month === planMonthKey(referenceDate))) return monthlyPlanStatus(state,planMonthKey(referenceDate),referenceDate);
  const range = projectionRange(mode, referenceDate, days);
  const totalBalance = spendingMoney(state).spendable;
  const settings = state.financialSettings?.projection || {};
  const events = getUpcomingCommitments(state, 30, range.start, range.end).map((item) => ({ ...item, delta: -item.amount }));
  const missing = [];
  const confidenceIssues = [];
  if (!(state.accounts || []).some(isAssetAccount)) missing.push("una cuenta de activo");

  const incomes = (state.recurringIncomes || []).filter((item) => item.active !== false && amount(item.amount) > 0);
  if (incomes.length) {
    incomes.forEach((income) => {
      if (!income.nextDate && !income.dayOfMonth) confidenceIssues.push(`fecha de cobro de ${income.name}`);
      addMonthlyOccurrences(events, { ...income, kind: "ingreso", stateTransactions: state.transactions || [] }, "ingreso", range.start, range.end);
    });
  } else if (amount(settings.expectedMonthlyIncome) > 0) {
    if (!settings.nextIncomeDate) confidenceIssues.push("próxima fecha de cobro");
    addMonthlyOccurrences(events, {
      id: "expected-income",
      name: "Ingreso esperado",
      amount: settings.expectedMonthlyIncome,
      nextDate: settings.nextIncomeDate,
      dayOfMonth: settings.nextIncomeDate ? null : endOfMonth(range.start).getDate(),
      frequency: settings.incomeFrequency || "mensual",
      kind: "ingreso",
      stateTransactions: state.transactions || [],
    }, "ingreso", range.start, range.end);
  } else {
    missing.push("un ingreso recurrente o esperado");
  }

  const rawVariable = settings.expectedVariableExpenses;
  const hasVariable = rawVariable !== null && rawVariable !== undefined && rawVariable !== "" && Number.isFinite(Number(rawVariable));
  if (!hasVariable) missing.push("gastos variables esperados");
  const variableExpenses = hasVariable ? amount(Number(rawVariable) * (daysBetweenInclusive(range.start, range.end) / 30)) : 0;
  if (variableExpenses > 0) events.push({ id: `variable-${range.mode}`, name: "Gastos variables estimados", amount: variableExpenses, date: range.end, kind: "gasto_variable", delta: -variableExpenses });

  const incompleteCards = (state.accounts || []).filter((account) => account.type === "tarjeta_credito" && amount(account.balance) < 0 && (!(amount(account.minimumPayment) > 0) || !account.paymentDay));
  incompleteCards.forEach((account) => confidenceIssues.push(`pago mínimo o fecha de ${account.name}`));
  getManualDebts(state).filter((debt) => amount(debt.balance) > 0 && (!(amount(debt.installment) > 0) || !debt.paymentDay)).forEach((debt) => confidenceIssues.push(`cuota o fecha de ${debt.name}`));
  [...(state.recurringExpenses || []), ...incomes].filter((item) => item.active !== false && (!item.frequency || (!item.nextDate && !item.dayOfMonth))).forEach((item) => confidenceIssues.push(`recurrencia o fecha de ${item.name}`));

  if (missing.length) return { available: false, missing, confidence: "insuficiente", confidenceIssues, start: totalBalance, end: null, timeline: [], startDate: localDateString(range.start), endDate: localDateString(range.end), days: daysBetweenInclusive(range.start, range.end), mode: range.mode };

  events.sort((a, b) => a.date - b.date);
  let running = totalBalance;
  const timeline = events.map((event) => { running = amount(running + event.delta); return { ...event, balanceAfter: running }; });
  const expectedIncome = amount(events.filter((event) => event.delta > 0).reduce((sum, event) => sum + event.delta, 0));
  const commitments = amount(events.filter((event) => event.delta < 0 && event.kind !== "gasto_variable").reduce((sum, event) => sum + Math.abs(event.delta), 0));
  const minPoint = timeline.reduce((minimum, event) => Math.min(minimum, event.balanceAfter), totalBalance);
  return {
    available: true,
    missing: [],
    confidence: confidenceIssues.length ? "baja" : "media",
    confidenceIssues: [...new Set(confidenceIssues)],
    start: totalBalance,
    end: running,
    timeline,
    minPoint,
    atRisk: minPoint < 0,
    expectedIncome,
    expectedVariableExpenses: variableExpenses,
    commitments,
    startDate: localDateString(range.start),
    endDate: localDateString(range.end),
    days: daysBetweenInclusive(range.start, range.end),
    mode: range.mode,
    formula: { initialBalance: totalBalance, expectedIncome, recurringAndDebtCommitments: commitments, variableExpenses },
  };
}

export function projectBalance(state, days = 30, referenceDate = new Date()) {
  return projectCashFlow(state, { mode: days === 30 ? "rolling_30" : "custom", days, referenceDate });
}

export function getFinancialHealthInputs(state, referenceDate = new Date()) {
  const period = summarizePeriod(state, startOfMonth(referenceDate), referenceDate);
  const settings = state.financialSettings || {};
  const essentialIds = settings.essentialCategoryIds || [];
  const essentialExpenses = amount(getOperationalTransactions(state, startOfMonth(referenceDate), referenceDate)
    .filter((transaction) => transaction.type === "gasto" && essentialIds.includes(transaction.category))
    .reduce((sum, transaction) => sum + amount(transaction.amount), 0));
  const debtPayments = getTotalDebtInstallments(state);
  const missing = [];
  if (!period.hasIncomeData) missing.push("un ingreso real del período");
  if (!period.hasExpenseData) missing.push("un gasto real del período");
  if (!settings.essentialExpensesConfigured || !essentialIds.length || !(essentialExpenses > 0)) missing.push("gastos esenciales configurados y registrados");
  if (!(Number(settings.savingsTargetValue) > 0)) missing.push("una meta mensual de ahorro");
  if (!state.emergencyFund?.configured) missing.push("un objetivo de fondo de emergencia");
  if (!(settings.debtStatus === "none" || settings.debtStatus === "has_debt")) missing.push("tu situación de deudas");
  if (settings.debtStatus === "has_debt" && getTotalDebtBalance(state) <= 0) missing.push("los detalles de tus deudas");
  const incompleteCards = (state.accounts || []).filter((account) => account.type === "tarjeta_credito" && amount(account.balance) < 0 && (!(amount(account.minimumPayment) > 0) || !account.paymentDay));
  if (incompleteCards.length) missing.push(`pago mínimo y fecha de ${incompleteCards.map((account) => account.name).join(", ")}`);
  return { period, essentialExpenses, debtPayments, missing };
}

export const FINANCIAL_HEALTH_WEIGHTS = { flujoCaja: 0.35, reserva: 0.25, endeudamiento: 0.25, planificacion: 0.15 };

export function calculateFinancialHealth(state, referenceDate = new Date()) {
  return actualFinancialHealth(state,planMonthKey(referenceDate),referenceDate);
}

export function hasFinancialData(state) {
  return (state.accounts || []).length > 0 || (state.transactions || []).length > 0 || (state.debts || []).length > 0 || (state.goals || []).length > 0;
}

export function getDataQuality(state, referenceDate = new Date()) {
  const real = (state.transactions || []).filter(isRealUserTransaction).sort((a, b) => dateOnly(a.date) - dateOnly(b.date));
  const ageDays = real.length ? daysBetweenInclusive(real[0].date, referenceDate) : 0;
  return { realMovementCount: real.length, ageDays, level: real.length < 2 ? "insuficiente" : ageDays < 30 ? "baja" : ageDays < 90 ? "media" : "alta" };
}
