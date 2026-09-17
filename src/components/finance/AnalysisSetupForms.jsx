import React, { useState } from "react";
import { useFinanceDispatch, useFinanceState } from "../../context/FinanceContext.jsx";
import { Button, Field, Input, Select , MoneyInput } from "../ui/primitives.jsx";
import { fmtBs } from "../../services/financial/format.js";
import { getTotalDebtInstallments } from "../../services/financial/calculations.js";
import { getFinancialDataReadiness } from "../../services/financial/readiness.js";

export function FinancialHealthSetupForm({ onSuccess }) {
  const state = useFinanceState();
  const dispatch = useFinanceDispatch();
  const settings = state.financialSettings || {};
  const readiness = getFinancialDataReadiness(state);
  const knownIncome = Number(state.profile.estimatedMonthlyIncome) || Number(readiness.latestMonth?.ingresos) || 0;
  const expenseCategories = state.categories.filter((category) => category.type === "gasto");
  const [income, setIncome] = useState(knownIncome || "");
  const [essentialIds, setEssentialIds] = useState(settings.essentialCategoryIds || []);
  const [savingsType, setSavingsType] = useState(settings.savingsTargetType || "percentage");
  const [savingsValue, setSavingsValue] = useState(settings.savingsTargetValue || "");
  const [emergencyMonths, setEmergencyMonths] = useState(state.emergencyFund?.monthsTarget || 3);
  const [debtStatus, setDebtStatus] = useState(settings.debtStatus || "unconfigured");

  function toggleEssential(id) {
    setEssentialIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  function submit(event) {
    event.preventDefault();
    const monthlyIncome = Number(income);
    const targetValue = Number(savingsValue);
    if (!(monthlyIncome > 0) || essentialIds.length === 0 || !(targetValue > 0) || debtStatus === "unconfigured") return;
    dispatch({ type: "UPDATE_PROFILE", payload: { estimatedMonthlyIncome: monthlyIncome } });
    dispatch({
      type: "UPDATE_FINANCIAL_SETTINGS",
      payload: {
        essentialExpensesConfigured: true,
        essentialCategoryIds: essentialIds,
        savingsTargetType: savingsType,
        savingsTargetValue: targetValue,
        debtStatus,
      },
    });
    dispatch({ type: "SET_EMERGENCY_FUND", payload: { monthsTarget: Number(emergencyMonths), configured: true } });
    onSuccess?.();
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      {knownIncome > 0 ? (
        <p className="rounded bg-paper-raised p-3 text-sm">
          Ingreso mensual conocido: <strong>{fmtBs(knownIncome, state.profile.currency)}</strong>
        </p>
      ) : (
        <Field label="Ingreso mensual aproximado">
          <MoneyInput currency={state.profile.currency} type="number" min="0.01" step="0.01" value={income} onChange={(event) => setIncome(event.target.value)} required />
        </Field>
      )}

      <fieldset>
        <legend className="text-xs text-ink-soft mb-2">¿Qué categorías consideras gastos esenciales?</legend>
        <div className="grid sm:grid-cols-2 gap-2">
          {expenseCategories.map((category) => (
            <label key={category.id} className="flex items-center gap-2 rounded border border-line px-3 py-2 text-sm">
              <input type="checkbox" checked={essentialIds.includes(category.id)} onChange={() => toggleEssential(category.id)} />
              {category.name}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Quiero ahorrar cada mes">
          <Select value={savingsType} onChange={(event) => setSavingsType(event.target.value)}>
            <option value="percentage">Un porcentaje de mis ingresos</option>
            <option value="amount">Un monto específico</option>
          </Select>
        </Field>
        <Field label={savingsType === "percentage" ? "Objetivo de ahorro (%)" : "Objetivo de ahorro mensual"}>
          {savingsType === "percentage" ? <Input type="number" min="0.01" step="0.01" value={savingsValue} onChange={event=>setSavingsValue(event.target.value)} required /> : <MoneyInput currency={state.profile.currency} type="number" min="0.01" step="0.01" value={savingsValue} onChange={event=>setSavingsValue(event.target.value)} required />}
        </Field>
      </div>

      <Field label="Objetivo de fondo de emergencia">
        <Select value={emergencyMonths} onChange={(event) => setEmergencyMonths(event.target.value)}>
          <option value="1">1 mes de gastos esenciales</option>
          <option value="3">3 meses de gastos esenciales</option>
          <option value="6">6 meses de gastos esenciales</option>
          <option value="12">12 meses (personalizado)</option>
        </Select>
      </Field>

      <Field label="¿Tienes deudas actualmente?">
        <Select value={debtStatus} onChange={(event) => setDebtStatus(event.target.value)} required>
          <option value="unconfigured">Selecciona una opción</option>
          <option value="none">No tengo deudas</option>
          <option value="has_debt">Sí, tengo deudas</option>
        </Select>
      </Field>
      {debtStatus === "has_debt" && state.debts.length === 0 ? (
        <p className="text-xs text-ink-soft">Después de guardar, registra los detalles de tus deudas en Planes para completar el análisis.</p>
      ) : null}

      <Button type="submit">Guardar configuración</Button>
    </form>
  );
}

export function ProjectionSetupForm({ onSuccess }) {
  const state = useFinanceState();
  const dispatch = useFinanceDispatch();
  const projection = state.financialSettings?.projection || {};
  const knownIncome = Number(state.profile.estimatedMonthlyIncome) || 0;
  const [expectedIncome, setExpectedIncome] = useState(projection.expectedMonthlyIncome || knownIncome || "");
  const [variableExpenses, setVariableExpenses] = useState(projection.expectedVariableExpenses ?? "");
  const [nextIncomeDate, setNextIncomeDate] = useState(projection.nextIncomeDate || "");
  const [incomeFrequency, setIncomeFrequency] = useState(projection.incomeFrequency || "mensual");
  const recurring = (state.recurringExpenses || []).reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  const debtPayments = getTotalDebtInstallments(state);

  function submit(event) {
    event.preventDefault();
    const income = Number(expectedIncome);
    const expenses = Number(variableExpenses);
    if (!(income > 0) || !Number.isFinite(expenses) || expenses < 0) return;
    dispatch({ type: "SET_PROJECTION_SETTINGS", payload: { expectedMonthlyIncome: income, expectedVariableExpenses: expenses, nextIncomeDate, incomeFrequency } });
    onSuccess?.();
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <p className="text-sm text-ink-soft">Usaremos automáticamente tus saldos, gastos recurrentes y pagos de deuda ya registrados.</p>
      <Field label="Ingresos mensuales esperados">
        <MoneyInput currency={state.profile.currency} type="number" min="0.01" step="0.01" value={expectedIncome} onChange={(event) => setExpectedIncome(event.target.value)} required />
      </Field>
      <Field label="Gastos variables esperados por mes">
        <MoneyInput currency={state.profile.currency} type="number" min="0" step="0.01" value={variableExpenses} onChange={(event) => setVariableExpenses(event.target.value)} required />
      </Field>
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Próxima fecha de cobro">
          <Input type="date" value={nextIncomeDate} onChange={(event) => setNextIncomeDate(event.target.value)} />
        </Field>
        <Field label="Recurrencia del ingreso">
          <Select value={incomeFrequency} onChange={(event) => setIncomeFrequency(event.target.value)}>
            <option value="mensual">Mensual</option>
            <option value="quincenal">Quincenal</option>
            <option value="semanal">Semanal</option>
          </Select>
        </Field>
      </div>
      <div className="rounded bg-paper-raised p-3 text-xs text-ink-soft">
        Ya registrados: {fmtBs(recurring, state.profile.currency)} en gastos recurrentes y {fmtBs(debtPayments, state.profile.currency)} en pagos mensuales de deuda.
      </div>
      <Button type="submit">Guardar y calcular</Button>
    </form>
  );
}
