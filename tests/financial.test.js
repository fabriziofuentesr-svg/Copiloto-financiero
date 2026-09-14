import test from "node:test";
import assert from "node:assert/strict";
import { fmtBs, fmtFecha, nextOccurrence, parseDate } from "../src/services/financial/format.js";
import { calculateAvailableMoney, calculateFinancialHealth, getTotalBalance, projectBalance } from "../src/services/financial/calculations.js";
import { getFinancialDataReadiness } from "../src/services/financial/readiness.js";
import { generateInsights } from "../src/services/financial/insights.js";
import { answerQuestion, extractAmount, parseLocalizedAmount } from "../src/services/financial/copilotEngine.js";
import { estimateGoalCompletion } from "../src/services/financial/goals.js";
import { ACCOUNT_TYPES } from "../src/data/mockData.js";

const referenceDate = new Date(2026, 8, 10, 12);

function state(overrides = {}) {
  return {
    profile: { estimatedMonthlyIncome: 500, currency: "BOB" },
    accounts: [{ id: "account", type: "efectivo", balance: 1000 }],
    transactions: [],
    categories: [{ id: "vivienda", name: "Vivienda", type: "gasto", essential: true }],
    paymentMethods: [],
    goals: [],
    debts: [{ id: "debt", name: "Deuda", paymentDay: 15, installment: 300, balance: 1000, rate: 20 }],
    recurringExpenses: [],
    emergencyFund: { current: 0, monthsTarget: 3, configured: false },
    financialSettings: {
      essentialExpensesConfigured: false,
      essentialCategoryIds: [],
      savingsTargetType: "percentage",
      savingsTargetValue: null,
      debtStatus: "unconfigured",
      projection: { expectedMonthlyIncome: 500, expectedVariableExpenses: 0 },
    },
    ...overrides,
  };
}

test("preserva fechas civiles y considera vencimientos del día actual", () => {
  assert.equal(parseDate("2026-09-10").getDate(), 10);
  assert.match(fmtFecha("2026-09-10"), /10/);
  assert.equal(nextOccurrence(10, referenceDate).getDate(), 10);
  assert.equal(nextOccurrence(31, new Date(2026, 3, 15)).getDate(), 30);
});

test("mantiene centavos y respeta la moneda elegida", () => {
  assert.match(fmtBs(200.5, "BOB"), /200,50/);
  assert.match(fmtBs(200.5, "USD"), /200,50/);
});

test("extrae el precio monetario y no el número del modelo", () => {
  assert.equal(extractAmount("¿Puedo comprar un iPhone 14 de Bs 8.000?"), 8000);
  assert.equal(extractAmount("¿Puedo comprar un celular por 80.000?"), 80000);
  assert.equal(extractAmount("¿Puedo comprar un iPhone 14?"), null);
  assert.equal(extractAmount("¿Puedo comprar una PlayStation 5?"), null);
  assert.equal(parseLocalizedAmount("200,50"), 200.5);
});

test("proyecta compromisos una sola vez y repite ingresos mensuales", () => {
  const current = calculateAvailableMoney(state(), referenceDate);
  assert.deepEqual({ committed: current.committed, available: current.available }, { committed: 300, available: 700 });
  const projection = projectBalance(state(), 180, referenceDate);
  assert.equal(projection.available, true);
  assert.equal(projection.start, 1000);
  assert.equal(projection.timeline.filter((event) => event.kind === "ingreso").length, 6);
  assert.equal(projection.timeline.filter((event) => event.kind === "deuda").length, 6);
  assert.equal(projection.end, 2200);
});

test("no calcula proyección cuando falta el valor de gastos variables", () => {
  const current = state();
  current.financialSettings.projection.expectedVariableExpenses = null;
  assert.equal(projectBalance(current, 30, referenceDate).available, false);
});

test("solo compara meses que tienen ingresos y gastos reales", () => {
  const incomplete = state({
    transactions: [
      { id: "i1", type: "ingreso", amount: 500, date: "2026-09-05" },
      { id: "g1", type: "gasto", amount: 100, category: "vivienda", date: "2026-08-05" },
    ],
  });
  assert.equal(getFinancialDataReadiness(incomplete).canCompareMonths, false);

  incomplete.transactions.push(
    { id: "g2", type: "gasto", amount: 100, category: "vivienda", date: "2026-09-06" },
    { id: "i2", type: "ingreso", amount: 500, date: "2026-08-06" },
  );
  assert.equal(getFinancialDataReadiness(incomplete).canCompareMonths, true);
});

test("la salud permanece no disponible hasta completar datos y configuración", () => {
  const current = state({
    transactions: [
      { id: "i1", type: "ingreso", amount: 500, date: "2026-09-05" },
      { id: "g1", type: "gasto", amount: 100, category: "vivienda", date: "2026-09-06" },
    ],
  });
  assert.equal(calculateFinancialHealth(current).available, false);

  current.financialSettings = {
    ...current.financialSettings,
    essentialExpensesConfigured: true,
    essentialCategoryIds: ["vivienda"],
    savingsTargetValue: 10,
    debtStatus: "has_debt",
  };
  current.emergencyFund = { current: 300, monthsTarget: 3, configured: true };
  const health = calculateFinancialHealth(current);
  assert.equal(health.available, true);
  assert.deepEqual(Object.keys(health.breakdown), ["flujoCaja", "reserva", "endeudamiento", "planificacion"]);
});

test("los insights iniciales no inventan una comparación histórica", () => {
  const current = state({ transactions: [{ id: "g1", type: "gasto", amount: 100, category: "vivienda", date: "2026-09-06" }] });
  const insights = generateInsights(current);
  assert.ok(insights.some((insight) => insight.id === "primeros-movimientos"));
  assert.ok(insights.every((insight) => !insight.detail.includes("mes anterior")));
});

test("Banco no aparece para cuentas nuevas y las cuentas antiguas siguen sumando", () => {
  assert.equal(ACCOUNT_TYPES.some((type) => type.id === "banco"), false);
  assert.equal(getTotalBalance(state({ accounts: [{ id: "legacy", type: "banco", balance: 750 }] })), 750);
});

test("un objetivo sin aporte no devuelve Infinity", () => {
  assert.equal(estimateGoalCompletion({ target: 100, current: 0, monthlyContribution: 0 }).months, null);
});

test("el Copiloto responde sobre el objetivo que se menciona", () => {
  const result = answerQuestion(state({ debts: [], goals: [
    { id: "first", name: "Auto", target: 1000, current: 0, monthlyContribution: 0 },
    { id: "second", name: "Viaje", target: 1000, current: 0, monthlyContribution: 100 },
  ] }), "¿Cómo va Viaje?");
  assert.match(result, /Viaje/);
  assert.doesNotMatch(result, /Auto/);
});
