import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildEmptyState } from "../src/data/mockData.js";
import { buildAccountCreation, getRealMovementProgress } from "../src/services/financial/ledger.js";
import { migrateState, CURRENT_SCHEMA_VERSION } from "../src/services/migrations.js";
import { fmtBs, fmtFecha, nextOccurrence, parseDate } from "../src/services/financial/format.js";
import { calculateAvailableMoney, calculateFinancialHealth, getMonthlyComparison, getOperationalTransactions, getTotalBalance, getTotalDebtBalance, getTotalDebtInstallments, projectCashFlow, summarizePeriod } from "../src/services/financial/calculations.js";
import { evaluatePurchase } from "../src/services/financial/purchaseAdvisor.js";
import { answerQuestion, extractAmount, parseLocalizedAmount } from "../src/services/financial/copilotEngine.js";

const referenceDate = new Date(2026, 8, 10, 12);
const createId = (prefix) => `${prefix}-fixed`;

function baseState(overrides = {}) {
  const empty = buildEmptyState();
  return {
    ...empty,
    profile: { ...empty.profile, name: "Ana", currency: "BOB", estimatedMonthlyIncome: 3000, onboardingCompleted: true },
    accounts: [{ id: "cash", name: "Efectivo", type: "efectivo", balance: 10000 }],
    categories: empty.categories,
    financialSettings: {
      ...empty.financialSettings,
      essentialExpensesConfigured: true,
      essentialCategoryIds: ["vivienda"],
      savingsTargetType: "amount",
      savingsTargetValue: 500,
      debtStatus: "none",
      projection: { expectedMonthlyIncome: 3000, expectedVariableExpenses: 500, nextIncomeDate: "2026-09-20", incomeFrequency: "mensual" },
    },
    emergencyFund: { current: 3000, monthsTarget: 3, configured: true },
    ...overrides,
  };
}

function realTransactions() {
  return [
    { id: "sep-income", type: "ingreso", amount: 3000, date: "2026-09-05", category: "salario", accountId: "cash", origin: "user" },
    { id: "sep-expense", type: "gasto", amount: 1000, date: "2026-09-06", category: "vivienda", accountId: "cash", origin: "user" },
    { id: "aug-income", type: "ingreso", amount: 2800, date: "2026-08-05", category: "salario", accountId: "cash", origin: "user" },
    { id: "aug-expense", type: "gasto", amount: 900, date: "2026-08-06", category: "vivienda", accountId: "cash", origin: "user" },
  ];
}

test("crear una cuenta de activo con 10.000 deja saldo exacto y un saldo inicial", () => {
  const built = buildAccountCreation({ id: "asset", name: "Ahorros", type: "ahorro", balance: 10000, currency: "BOB" }, createId, referenceDate);
  const state = baseState({ accounts: [built.account], transactions: [built.openingTransaction] });
  assert.equal(getTotalBalance(state), 10000);
  assert.equal(state.transactions.length, 1);
  assert.deepEqual({ type: built.openingTransaction.type, category: built.openingTransaction.category, origin: built.openingTransaction.origin, linkedAccountId: built.openingTransaction.linkedAccountId }, { type: "ingreso", category: "saldo_inicial", origin: "initial_balance", linkedAccountId: "asset" });
});

test("recrear o migrar no duplica el movimiento de apertura", () => {
  const first = buildAccountCreation({ id: "asset", name: "Ahorros", type: "ahorro", balance: 10000 }, createId, referenceDate);
  const retried = buildAccountCreation({ id: "asset", name: "Ahorros", type: "ahorro", balance: 10000 }, createId, referenceDate);
  assert.equal(first.openingTransaction.id, retried.openingTransaction.id);
  const migrated = migrateState(migrateState(baseState({ accounts: [first.account], transactions: [first.openingTransaction] })));
  assert.equal(migrated.transactions.filter((item) => item.origin === "initial_balance").length, 1);
});

test("crear una cuenta con saldo cero no crea movimiento", () => {
  const built = buildAccountCreation({ id: "asset", name: "Vacía", type: "efectivo", balance: 0 }, createId, referenceDate);
  assert.equal(built.account.balance, 0);
  assert.equal(built.openingTransaction, null);
});

test("una tarjeta con 500 utilizados no crea ingreso y sí afecta deuda y compromisos", () => {
  const built = buildAccountCreation({ id: "card", name: "Tarjeta", type: "tarjeta_credito", balance: 500, creditLimit: 2000, minimumPayment: 100, paymentDay: 20 }, createId, referenceDate);
  const state = baseState({ accounts: [{ id: "cash", type: "efectivo", balance: 1000 }, built.account] });
  assert.equal(built.openingTransaction, null);
  assert.equal(built.account.balance, -500);
  assert.equal(getTotalDebtBalance(state), 500);
  assert.equal(getTotalDebtInstallments(state), 100);
  assert.equal(calculateAvailableMoney(state, referenceDate).committed, 100);
});

test("el saldo inicial aparece en el libro pero no infla ingreso operativo ni balance neto", () => {
  const opening = buildAccountCreation({ id: "asset", name: "Ahorros", type: "ahorro", balance: 10000 }, createId, referenceDate).openingTransaction;
  const state = baseState({ transactions: [opening] });
  const summary = summarizePeriod(state, new Date(2026, 8, 1), new Date(2026, 8, 30));
  assert.equal(state.transactions.length, 1);
  assert.deepEqual({ ingresos: summary.ingresos, gastos: summary.gastos, balance: summary.balanceNeto }, { ingresos: 0, gastos: 0, balance: 0 });
  assert.equal(getOperationalTransactions(state, new Date(2026, 8, 1), new Date(2026, 8, 30)).length, 0);
});

test("la guía de primeros movimientos ignora saldo inicial y exige ingreso y gasto reales", () => {
  const opening = buildAccountCreation({ id: "asset", name: "Ahorros", type: "ahorro", balance: 100 }, createId, referenceDate).openingTransaction;
  let state = baseState({ transactions: [opening] });
  assert.deepEqual(getRealMovementProgress(state), { hasIncome: false, hasExpense: false, complete: false, count: 0 });
  state = { ...state, transactions: [...state.transactions, { id: "i", type: "ingreso", amount: 1, date: "2026-09-09", origin: "user" }] };
  assert.equal(getRealMovementProgress(state).complete, false);
  state.transactions.push({ id: "g", type: "gasto", amount: 1, date: "2026-09-09", origin: "user" });
  assert.equal(getRealMovementProgress(state).complete, true);
});

test("un ingreso recurrente ya cobrado no vuelve a sumarse en la proyección", () => {
  const state = baseState({ recurringIncomes: [{ id: "salary", name: "Sueldo", amount: 3000, frequency: "mensual", nextDate: "2026-09-15", active: true }], transactions: [{ id: "paid", type: "ingreso", amount: 3000, date: "2026-09-05", recurringId: "salary", origin: "user" }] });
  const projection = projectCashFlow(state, { mode: "month_end", referenceDate });
  assert.equal(projection.expectedIncome, 0);
});

test("cierre de mes y próximos 30 días tienen horizontes distintos", () => {
  const state = baseState({ recurringIncomes: [{ id: "salary", name: "Sueldo", amount: 3000, frequency: "mensual", nextDate: "2026-09-20", active: true }] });
  const monthEnd = projectCashFlow(state, { mode: "month_end", referenceDate });
  const rolling = projectCashFlow(state, { mode: "rolling_30", referenceDate });
  assert.equal(monthEnd.endDate, "2026-09-30");
  assert.equal(rolling.endDate, "2026-10-09");
  assert.equal(rolling.days, 30);
  assert.notEqual(monthEnd.days, rolling.days);
  assert.equal(monthEnd.expectedIncome, 3000);
  assert.equal(monthEnd.end, monthEnd.start + 3000 - monthEnd.expectedVariableExpenses);
});

test("una compra que baja de la reserva mínima nunca es verde", () => {
  const state = baseState({ transactions: realTransactions(), accounts: [{ id: "cash", type: "efectivo", balance: 5000 }] });
  const result = evaluatePurchase(state, 2500, referenceDate);
  assert.notEqual(result.verdict, "si");
  assert.ok(result.reserveAfter < result.reserveTarget);
});

test("una reserva actual en cero impide un veredicto verde aunque sobre efectivo", () => {
  const state = baseState({ transactions: realTransactions(), emergencyFund: { current: 0, monthsTarget: 3, configured: true } });
  const result = evaluatePurchase(state, 100, referenceDate);
  assert.notEqual(result.verdict, "si");
  assert.equal(result.reserveAfter, 0);
  assert.ok(result.reserveTarget > 0);
});

test("una compra superior al disponible es roja", () => {
  const result = evaluatePurchase(baseState({ transactions: realTransactions(), accounts: [{ id: "cash", type: "efectivo", balance: 1000 }] }), 1001, referenceDate);
  assert.equal(result.verdict, "no");
});

test("una evaluación con información insuficiente lo dice sin verde", () => {
  const state = baseState({ financialSettings: buildEmptyState().financialSettings, emergencyFund: buildEmptyState().emergencyFund });
  const result = evaluatePurchase(state, 100, referenceDate);
  assert.equal(result.verdict, "incomplete");
  assert.ok(result.missing.length > 0);
});

test("la tarjeta afecta salud y proyección sin duplicarse con una deuda enlazada", () => {
  const card = buildAccountCreation({ id: "card", name: "Visa", type: "tarjeta_credito", balance: 500, minimumPayment: 100, paymentDay: 20 }, createId, referenceDate).account;
  const state = baseState({ transactions: realTransactions(), accounts: [{ id: "cash", type: "efectivo", balance: 10000 }, card], debts: [{ id: "manual-card", name: "Visa", balance: 500, installment: 100, paymentDay: 20, linkedAccountId: "card" }], financialSettings: { ...baseState().financialSettings, debtStatus: "has_debt" } });
  assert.equal(getTotalDebtBalance(state), 500);
  assert.equal(getTotalDebtInstallments(state), 100);
  assert.equal(calculateFinancialHealth(state, referenceDate).available, true);
  assert.equal(projectCashFlow(state, { mode: "month_end", referenceDate }).commitments, 100);
});

test("la comparación usa días equivalentes y excluye saldo inicial", () => {
  const opening = buildAccountCreation({ id: "asset", name: "Ahorros", type: "ahorro", balance: 9000 }, createId, referenceDate).openingTransaction;
  const comparison = getMonthlyComparison(baseState({ transactions: [...realTransactions(), opening] }), referenceDate);
  assert.equal(comparison.available, true);
  assert.deepEqual({ currentEnd: comparison.current.end, previousEnd: comparison.previous.end, currentIncome: comparison.current.ingresos }, { currentEnd: "2026-09-10", previousEnd: "2026-08-10", currentIncome: 3000 });
});

test("el Copiloto responde numéricamente si se puede ahorrar 1.000", () => {
  const answer = answerQuestion(baseState({ transactions: realTransactions() }), "¿Puedo ahorrar Bs 1.000 este mes?", referenceDate);
  assert.match(answer, /1\.000,00/);
  assert.match(answer, /Quedarían/);
});

test("Cuentas está en la navegación visible y enlazada desde Inicio", async () => {
  const desktop = await readFile(new URL("../src/layout/Sidebar.jsx", import.meta.url), "utf8");
  const mobile = await readFile(new URL("../src/layout/BottomNav.jsx", import.meta.url), "utf8");
  const navigation = await readFile(new URL("../src/layout/navConfig.js", import.meta.url), "utf8");
  const home = await readFile(new URL("../src/pages/Inicio.jsx", import.meta.url), "utf8");
  assert.match(desktop, /MAIN_NAV/);
  assert.match(mobile, /MAIN_NAV/);
  assert.match(navigation, /\/cuentas/);
  assert.match(home, /Ver y editar cuentas/);
});

test("cuentas, movimientos, objetivos y deudas tienen operaciones de edición trazables", async () => {
  const reducer = await readFile(new URL("../src/context/FinanceContext.jsx", import.meta.url), "utf8");
  for (const action of ["UPDATE_ACCOUNT_METADATA", "ADJUST_ACCOUNT_BALANCE", "UPDATE_TRANSACTION", "UPDATE_GOAL", "UPDATE_DEBT"]) assert.match(reducer, new RegExp(action));
  assert.match(reducer, /balance_adjustment/);
});

test("el cambio de moneda no reinterpreta silenciosamente valores existentes", () => {
  const old = { profile: { currency: "BOB" }, accounts: [{ id: "a", type: "banco", balance: 123.45 }], transactions: [{ id: "t", type: "ingreso", amount: 25.5, date: "2025-01-01" }] };
  const migrated = migrateState(old);
  assert.equal(migrated.profile.currency, "BOB");
  assert.equal(migrated.accounts[0].balance, 123.45);
  assert.equal(migrated.transactions[0].amount, 25.5);
});

test("los datos de la versión anterior migran sin pérdida y con nuevos valores por defecto", () => {
  const old = { profile: { name: "Luis", currency: "BOB" }, accounts: [{ id: "legacy", name: "Banco", type: "banco", balance: 750 }], transactions: [{ id: "legacy-tx", type: "gasto", amount: 10, date: "2025-01-01", accountId: "legacy" }], goals: [{ id: "goal", name: "Viaje", target: 1000, current: 100 }], debts: [] };
  const migrated = migrateState(old);
  assert.equal(migrated.schemaVersion, CURRENT_SCHEMA_VERSION);
  assert.equal(migrated.accounts[0].type, "banco");
  assert.equal(migrated.transactions[0].origin, "user");
  assert.equal(migrated.transactions[0].linkedAccountId, "legacy");
  assert.equal(migrated.goals[0].name, "Viaje");
  assert.ok(migrated.categories.some((item) => item.id === "saldo_inicial"));
});

test("fechas civiles, centavos y montos localizados mantienen precisión", () => {
  assert.equal(parseDate("2026-09-10").getDate(), 10);
  assert.match(fmtFecha("2026-09-10"), /10/);
  assert.equal(nextOccurrence(31, new Date(2026, 3, 15)).getDate(), 30);
  assert.match(fmtBs(200.5, "BOB"), /200,50/);
  assert.equal(extractAmount("iPhone 14 de Bs 8.000"), 8000);
  assert.equal(parseLocalizedAmount("200,50"), 200.5);
});
