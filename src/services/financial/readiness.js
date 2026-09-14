function monthKey(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function summarizeMonthKey(state, key) {
  const transactions = (state.transactions || []).filter((transaction) => monthKey(transaction.date) === key);
  const incomes = transactions.filter((transaction) => transaction.type === "ingreso");
  const expenses = transactions.filter((transaction) => transaction.type === "gasto");
  const ingresos = incomes.reduce((sum, transaction) => sum + (Number(transaction.amount) || 0), 0);
  const gastos = expenses.reduce((sum, transaction) => sum + (Number(transaction.amount) || 0), 0);
  return {
    key,
    transactionCount: transactions.length,
    hasIncomeData: incomes.length > 0,
    hasExpenseData: expenses.length > 0,
    ingresos,
    gastos,
    ahorro: incomes.length > 0 && expenses.length > 0 ? ingresos - gastos : null,
  };
}

export function getComparableMonths(state) {
  const keys = [...new Set((state.transactions || []).map((transaction) => monthKey(transaction.date)).filter(Boolean))]
    .sort()
    .reverse();
  const completeMonths = keys
    .map((key) => summarizeMonthKey(state, key))
    .filter((month) => month.hasIncomeData && month.hasExpenseData);
  if (completeMonths.length < 2) return null;
  return { current: completeMonths[0], previous: completeMonths[1] };
}

export function getLatestMonthSummary(state) {
  const key = [...new Set((state.transactions || []).map((transaction) => monthKey(transaction.date)).filter(Boolean))]
    .sort()
    .reverse()[0];
  return key ? summarizeMonthKey(state, key) : null;
}

export function getFinancialDataReadiness(state) {
  const settings = state.financialSettings || {};
  const transactions = state.transactions || [];
  const latestMonth = getLatestMonthSummary(state);
  const hasAccounts = (state.accounts || []).length > 0;
  const hasIncomeData = Boolean(latestMonth?.hasIncomeData);
  const hasExpenseData = Boolean(latestMonth?.hasExpenseData);
  const essentialIds = settings.essentialCategoryIds || [];
  const hasEssentialTransactions = transactions.some(
    (transaction) => transaction.type === "gasto" && monthKey(transaction.date) === latestMonth?.key && essentialIds.includes(transaction.category),
  );
  const hasEssentialExpenses = Boolean(settings.essentialExpensesConfigured) && essentialIds.length > 0 && hasEssentialTransactions;
  const hasSavingsGoal = Number(settings.savingsTargetValue) > 0;
  const hasDebtConfiguration = settings.debtStatus === "none" || (settings.debtStatus === "has_debt" && (state.debts || []).length > 0);
  const hasEmergencyTarget = Boolean(state.emergencyFund?.configured);
  const comparableMonths = getComparableMonths(state);
  const canCompareMonths = Boolean(comparableMonths);
  const expectedIncome = Number(settings.projection?.expectedMonthlyIncome || state.profile?.estimatedMonthlyIncome) || 0;
  const rawExpenseForecast = settings.projection?.expectedVariableExpenses;
  const hasExpenseForecast = rawExpenseForecast !== null && rawExpenseForecast !== undefined && rawExpenseForecast !== "" && Number.isFinite(Number(rawExpenseForecast));
  const canCalculateProjection = hasAccounts && expectedIncome > 0 && hasExpenseForecast;
  const canCalculateFinancialHealth =
    hasAccounts && hasIncomeData && hasExpenseData && hasEssentialExpenses && hasSavingsGoal && hasDebtConfiguration && hasEmergencyTarget;

  const healthMissing = [];
  if (!hasAccounts) healthMissing.push("una cuenta con saldo");
  if (!hasIncomeData) healthMissing.push("ingresos registrados");
  if (!hasExpenseData) healthMissing.push("gastos registrados");
  if (!hasEssentialExpenses) healthMissing.push("tus gastos esenciales");
  if (!hasSavingsGoal) healthMissing.push("una meta personal de ahorro");
  if (!hasDebtConfiguration) healthMissing.push(settings.debtStatus === "has_debt" ? "los detalles de tus deudas" : "si actualmente tienes deudas");
  if (!hasEmergencyTarget) healthMissing.push("tu objetivo de fondo de emergencia");

  const projectionMissing = [];
  if (!hasAccounts) projectionMissing.push("una cuenta con saldo");
  if (!(expectedIncome > 0)) projectionMissing.push("tus ingresos esperados");
  if (!hasExpenseForecast) projectionMissing.push("tus gastos variables esperados");

  return {
    hasAccounts,
    hasIncomeData,
    hasExpenseData,
    hasEssentialExpenses,
    hasSavingsGoal,
    hasDebtConfiguration,
    hasEmergencyTarget,
    hasTwoComparableMonths: canCompareMonths,
    canCompareMonths,
    canCalculateFinancialHealth,
    canCalculateProjection,
    comparableMonths,
    latestMonth,
    healthMissing,
    projectionMissing,
  };
}

export function canCalculateFinancialHealth(state) {
  return getFinancialDataReadiness(state).canCalculateFinancialHealth;
}
