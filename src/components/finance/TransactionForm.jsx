import React, { useState } from "react";
import { useFinanceDispatch, useFinanceState } from "../../context/FinanceContext.jsx";
import { Button, Field, Input, Select } from "../ui/primitives.jsx";

function formatInputDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildInitialForm(state, type) {
  return {
    description: "",
    amount: "",
    date: formatInputDate(),
    category: state.categories.find((category) => category.type === type)?.id || "",
    accountId: state.accounts[0]?.id || "",
    paymentMethod: state.paymentMethods[0]?.id || "",
    type,
  };
}

export function TransactionForm({ initialType = "gasto", lockType = false, onSuccess, submitLabel = "Guardar" }) {
  const state = useFinanceState();
  const dispatch = useFinanceDispatch();
  const [form, setForm] = useState(() => buildInitialForm(state, initialType));
  const availableCategories = state.categories.filter((category) => category.type === form.type);

  function changeType(type) {
    setForm((current) => ({
      ...current,
      type,
      category: state.categories.find((category) => category.type === type)?.id || "",
    }));
  }

  function handleSubmit(event) {
    event.preventDefault();
    const amount = Number(form.amount);
    if (!form.description.trim() || !Number.isFinite(amount) || amount <= 0 || !form.accountId) return;

    dispatch({
      type: "ADD_TRANSACTION",
      payload: { ...form, description: form.description.trim(), amount },
    });
    const completedType = form.type;
    setForm(buildInitialForm(state, completedType));
    onSuccess?.(completedType);
  }

  if (state.accounts.length === 0) {
    return (
      <div className="rounded border border-dashed border-line bg-paper-raised p-4 text-sm text-ink-soft">
        Añade una cuenta antes de registrar un movimiento para poder asignarle el ingreso o gasto.
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      {!lockType ? (
        <div className="grid grid-cols-2 gap-2" role="group" aria-label="Tipo de movimiento">
          <Button type="button" variant={form.type === "ingreso" ? "primary" : "secondary"} onClick={() => changeType("ingreso")}>
            Ingreso
          </Button>
          <Button type="button" variant={form.type === "gasto" ? "primary" : "secondary"} onClick={() => changeType("gasto")}>
            Gasto
          </Button>
        </div>
      ) : null}
      <Field label="Descripción">
        <Input
          value={form.description}
          onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
          placeholder={form.type === "ingreso" ? "Sueldo mensual" : "Ej. Supermercado"}
          required
        />
      </Field>
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label={`Monto (${state.profile.currency === "USD" ? "USD" : "Bs"})`}>
          <Input
            type="number"
            min="0.01"
            step="0.01"
            value={form.amount}
            onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))}
            required
          />
        </Field>
        <Field label="Fecha">
          <Input
            type="date"
            value={form.date}
            onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))}
            required
          />
        </Field>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Categoría">
          <Select value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}>
            {availableCategories.map((category) => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </Select>
        </Field>
        <Field label="Cuenta">
          <Select value={form.accountId} onChange={(event) => setForm((current) => ({ ...current, accountId: event.target.value }))}>
            {state.accounts.map((account) => (
              <option key={account.id} value={account.id}>{account.name}</option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label="Método de pago">
        <Select value={form.paymentMethod} onChange={(event) => setForm((current) => ({ ...current, paymentMethod: event.target.value }))}>
          {state.paymentMethods.map((method) => (
            <option key={method.id} value={method.id}>{method.name}</option>
          ))}
        </Select>
      </Field>
      <Button type="submit" className="mt-1">{submitLabel}</Button>
    </form>
  );
}
