import { getFinancialHealthInputs, getMonthlyComparison, projectCashFlow, summarizePeriod } from "./calculations.js";
import { endOfMonth, startOfMonth } from "./format.js";
import { getRealMovementProgress } from "./ledger.js";

export function summarizeMonthKey(state, key) {
  const [year, month] = key.split("-").map(Number);
  return { key, ...summarizePeriod(state, new Date(year, month - 1, 1), new Date(year, month, 0)) };
}

export function getComparableMonths(state, referenceDate = new Date()) {
  const comparison = getMonthlyComparison(state, referenceDate);
  return comparison.available ? { current: comparison.current, previous: comparison.previous, ...comparison } : null;
}

export function getLatestMonthSummary(state, referenceDate = new Date()) {
  const summary = summarizePeriod(state, startOfMonth(referenceDate), endOfMonth(referenceDate));
  return { ...summary, key: summary.start.slice(0, 7) };
}

export function getFinancialDataReadiness(state, referenceDate = new Date()) {
  const settings = state.financialSettings || {};
  const progress = getRealMovementProgress(state);
  const latestMonth = getLatestMonthSummary(state, referenceDate);
  const comparison = getMonthlyComparison(state, referenceDate);
  const healthInputs = getFinancialHealthInputs(state, referenceDate);
  const monthEndProjection = projectCashFlow(state, { mode: "month_end", referenceDate });
  const rollingProjection = projectCashFlow(state, { mode: "rolling_30", referenceDate });
  const hasAccounts = (state.accounts || []).some((account) => account.type !== "tarjeta_credito");
  const hasEssentialExpenses = Boolean(settings.essentialExpensesConfigured) && healthInputs.essentialExpenses > 0;
  const hasSavingsGoal = Number(settings.savingsTargetValue) > 0;
  const hasDebtConfiguration = settings.debtStatus === "none" || (settings.debtStatus === "has_debt" && healthInputs.missing.every((item) => item !== "los detalles de tus deudas"));
  const hasEmergencyTarget = Boolean(state.emergencyFund?.configured);

  return {
    hasAccounts,
    hasIncomeData: progress.hasIncome,
    hasExpenseData: progress.hasExpense,
    hasEssentialExpenses,
    hasSavingsGoal,
    hasDebtConfiguration,
    hasEmergencyTarget,
    hasTwoComparableMonths: comparison.available,
    canCompareMonths: comparison.available,
    canCalculateFinancialHealth: healthInputs.missing.length === 0,
    canCalculateProjection: rollingProjection.available,
    comparison,
    comparableMonths: comparison.available ? { current: comparison.current, previous: comparison.previous } : null,
    latestMonth,
    healthMissing: healthInputs.missing,
    projectionMissing: rollingProjection.missing,
    monthEndProjection,
    rollingProjection,
    firstMovements: progress,
  };
}

export function canCalculateFinancialHealth(state, referenceDate = new Date()) {
  return getFinancialDataReadiness(state, referenceDate).canCalculateFinancialHealth;
}
