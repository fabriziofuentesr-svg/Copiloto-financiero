import React, { useState } from "react";
import { useFinanceDispatch, useFinanceState } from "../../context/FinanceContext.jsx";
import { addMonths, localDateString, parseDate } from "../../services/financial/format.js";
import { Button, Field, Input, Select } from "../ui/primitives.jsx";

function buildInitialForm(state, type, transaction) {
  if (transaction) return {
    description: transaction.description || "", amount: String(transaction.amount || ""), date: localDateString(transaction.date),
    category: transaction.category || "", accountId: transaction.accountId || "", paymentMethod: transaction.paymentMethod || "", type: transaction.type,
  };
  return { description: "", amount: "", date: localDateString(), category: state.categories.find((category) => category.type === type && !category.system)?.id || "", accountId: state.accounts[0]?.id || "", paymentMethod: state.paymentMethods[0]?.id || "", type };
}

export function TransactionForm({ initialType = "gasto", lockType = false, transaction = null, onSuccess, submitLabel }) {
  const state = useFinanceState();
  const dispatch = useFinanceDispatch();
  const [form, setForm] = useState(() => buildInitialForm(state, initialType, transaction));
  const [recurring, setRecurring] = useState(false);
  const editing = Boolean(transaction);
  const availableCategories = state.categories.filter((category) => category.type === form.type && !category.system);

  function changeType(type) {
    setForm((current) => ({ ...current, type, category: state.categories.find((category) => category.type === type && !category.system)?.id || "" }));
  }

  function handleSubmit(event) {
    event.preventDefault();
    const movementAmount = Number(form.amount);
    if (!form.description.trim() || !Number.isFinite(movementAmount) || movementAmount <= 0 || !form.accountId || !form.date) return;
    if (editing) {
      dispatch({ type: "UPDATE_TRANSACTION", payload: { id: transaction.id, ...form, description: form.description.trim(), amount: movementAmount } });
    } else {
      const recurringId = recurring ? `rec-${Date.now()}-${Math.floor(Math.random() * 10000)}` : null;
      if (recurringId) {
        const date = parseDate(form.date);
        dispatch({
          type: "ADD_TRANSACTION_WITH_RECURRENCE",
          payload: {
            transaction: { ...form, description: form.description.trim(), amount: movementAmount, recurringId },
            recurrence: { id: recurringId, kind: form.type, name: form.description.trim(), category: form.category, amount: movementAmount, frequency: "mensual", dayOfMonth: date.getDate(), nextDate: localDateString(addMonths(date, 1)), active: true },
          },
        });
      } else {
        dispatch({ type: "ADD_TRANSACTION", payload: { ...form, description: form.description.trim(), amount: movementAmount, recurringId: null } });
      }
      setForm(buildInitialForm(state, form.type));
    }
    onSuccess?.(form.type);
  }

  if (state.accounts.length === 0) return <div className="rounded border border-dashed border-line bg-paper-raised p-4 text-sm text-ink-soft">Añade una cuenta antes de registrar un movimiento.</div>;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      {!lockType ? <div className="grid grid-cols-2 gap-2" role="group" aria-label="Tipo de movimiento"><Button type="button" variant={form.type === "ingreso" ? "primary" : "secondary"} onClick={() => changeType("ingreso")}>Ingreso</Button><Button type="button" variant={form.type === "gasto" ? "primary" : "secondary"} onClick={() => changeType("gasto")}>Gasto</Button></div> : null}
      <Field label="Descripción"><Input value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} placeholder={form.type === "ingreso" ? "Sueldo mensual" : "Ej. Supermercado"} required /></Field>
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label={`Monto (${state.profile.currency === "USD" ? "USD" : "Bs"})`}><Input type="number" min="0.01" step="0.01" value={form.amount} onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))} required /></Field>
        <Field label="Fecha"><Input type="date" value={form.date} onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))} required /></Field>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Categoría"><Select value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}>{availableCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</Select></Field>
        <Field label="Cuenta"><Select value={form.accountId} onChange={(event) => setForm((current) => ({ ...current, accountId: event.target.value }))}>{state.accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</Select></Field>
      </div>
      <Field label="Método de pago"><Select value={form.paymentMethod} onChange={(event) => setForm((current) => ({ ...current, paymentMethod: event.target.value }))}>{state.paymentMethods.map((method) => <option key={method.id} value={method.id}>{method.name}</option>)}</Select></Field>
      {!editing ? <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={recurring} onChange={(event) => setRecurring(event.target.checked)} /> Repetir mensualmente y usar en proyecciones</label> : null}
      <Button type="submit" className="mt-1">{submitLabel || (editing ? "Guardar cambios" : "Guardar")}</Button>
    </form>
  );
}
