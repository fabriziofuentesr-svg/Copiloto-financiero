import test from "node:test";
import assert from "node:assert/strict";
import { fmtBs, fmtFecha, nextOccurrence, parseDate } from "../src/services/financial/format.js";
import {
  calculateAvailableMoney,
  calculateFinancialHealth,
  getUpcomingCommitments,
  projectBalance,
} from "../src/services/financial/calculations.js";
import { answerQuestion, extractAmount, parseLocalizedAmount } from "../src/services/financial/copilotEngine.js";
import { estimateGoalCompletion } from "../src/services/financial/goals.js";

const referenceDate = new Date(2026, 8, 10, 12);

function state(overrides = {}) {
  return {
    profile: { incomeDay: 5, estimatedMonthlyIncome: 500, currency: "BOB" },
    accounts: [{ id: "account", type: "banco", balance: 1000 }],
    transactions: [],
    categories: [],
    paymentMethods: [],
    goals: [],
    debts: [{ id: "debt", name: "Deuda", paymentDay: 15, installment: 300, balance: 1000 }],
    recurringExpenses: [],
    emergencyFund: { current: 0, monthsTarget: 3 },
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
  assert.deepEqual(
    { committed: current.committed, available: current.available },
    { committed: 300, available: 700 }
  );

  const projection = projectBalance(state(), 180, referenceDate);
  assert.equal(projection.start, 1000);
  assert.equal(projection.timeline.filter((event) => event.kind === "ingreso").length, 6);
  assert.equal(projection.timeline.filter((event) => event.kind === "deuda").length, 6);
  assert.equal(projection.end, 2200);
});

test("no califica una deuda como saludable cuando no hay ingresos registrados", () => {
  const health = calculateFinancialHealth(state());
  assert.equal(health.breakdown.endeudamiento, 0);
});

test("un objetivo sin aporte no devuelve Infinity", () => {
  assert.equal(estimateGoalCompletion({ target: 100, current: 0, monthlyContribution: 0 }).months, null);
});

test("el Copiloto responde sobre el objetivo que se menciona", () => {
  const result = answerQuestion(
    state({
      debts: [],
      goals: [
        { id: "first", name: "Auto", target: 1000, current: 0, monthlyContribution: 0 },
        { id: "second", name: "Viaje", target: 1000, current: 0, monthlyContribution: 100 },
      ],
    }),
    "¿Cómo va Viaje?"
  );
  assert.match(result, /Viaje/);
  assert.doesNotMatch(result, /Auto/);
});

