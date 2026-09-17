import { buildEmptyState, CATEGORIES } from "../data/mockData.js";
import { normalizeCategory } from "./categories.js";
import { categorySnapshot } from "./financial/monthlyPlan.js";
import { ensureStandardSavings } from "./financial/standardSavings.js";

export const CURRENT_SCHEMA_VERSION = 4;

function mergeCategories(saved = []) {
  const byId = new Map(CATEGORIES.map((category) => [category.id, category]));
  saved.forEach((category) => byId.set(category.id, { ...byId.get(category.id), ...category }));
  return [...byId.values()].map(normalizeCategory);
}

export function migrateState(savedState) {
  const empty = buildEmptyState();
  if (!savedState) return empty;
  const categories = mergeCategories(savedState.categories);
  const transactions = (savedState.transactions || []).map((transaction) => ({
    origin: "user",
    generated: false,
    linkedAccountId: transaction.accountId || null,
    recurringId: null,
    categorySnapshot: categorySnapshot(categories.find(category=>category.id === transaction.category)),
    ...transaction,
  }));
  const accounts = (savedState.accounts || []).map((account) => ({
    creditLimit: null,
    statementDay: null,
    paymentDay: null,
    minimumPayment: null,
    rate: null,
    ...account,
  }));
  const recurringExpenses = (savedState.recurringExpenses || []).map((item) => ({
    frequency: "mensual",
    nextDate: null,
    active: true,
    ...item,
  }));
  const debts = (savedState.debts || []).map((debt) => ({ linkedAccountId: null, ...debt }));
  return ensureStandardSavings({
    ...empty,
    ...savedState,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    profile: { ...empty.profile, timezone: "America/La_Paz", ...(savedState.profile || {}) },
    accounts,
    goals: (savedState.goals || []).map(goal=>({contributionFrequency:"mensual", archived:false,...goal, needsReconciliation:Number(goal.current || 0) > (savedState.savingsAllocations || []).filter(row=>row.goalId===goal.id).reduce((sum,row)=>sum+Number(row.amount),0)})),
    transactions,
    categories,
    monthlyPlans: savedState.monthlyPlans || [],
    savingsAllocations: savedState.savingsAllocations || [],
    recurringExpenses,
    debts,
    recurringIncomes: (savedState.recurringIncomes || []).map((item) => ({ frequency: "mensual", active: true, ...item })),
    savingsContributions: savedState.savingsContributions || [],
    processedRequestIds: savedState.processedRequestIds || [],
    currencyHistory: savedState.currencyHistory || [],
    emergencyFund: { ...empty.emergencyFund, ...(savedState.emergencyFund || {}) },
    financialSettings: {
      ...empty.financialSettings,
      ...(savedState.financialSettings || {}),
      projection: { ...empty.financialSettings.projection, ...(savedState.financialSettings?.projection || {}) },
    },
    sectionGuidesSeen: savedState.sectionGuidesSeen || {},
  });
}
