import { buildEmptyState, CATEGORIES } from "../data/mockData.js";

export const CURRENT_SCHEMA_VERSION = 2;

function mergeCategories(saved = []) {
  const byId = new Map(CATEGORIES.map((category) => [category.id, category]));
  saved.forEach((category) => byId.set(category.id, { ...byId.get(category.id), ...category }));
  return [...byId.values()];
}

export function migrateState(savedState) {
  const empty = buildEmptyState();
  if (!savedState) return empty;
  const transactions = (savedState.transactions || []).map((transaction) => ({
    origin: "user",
    generated: false,
    linkedAccountId: transaction.accountId || null,
    recurringId: null,
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
  return {
    ...empty,
    ...savedState,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    profile: { ...empty.profile, ...(savedState.profile || {}) },
    accounts,
    transactions,
    categories: mergeCategories(savedState.categories),
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
  };
}
