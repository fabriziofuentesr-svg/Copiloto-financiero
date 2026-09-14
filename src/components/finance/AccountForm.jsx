import React, { useState } from "react";
import { useFinanceDispatch, useFinanceState } from "../../context/FinanceContext.jsx";
import { ACCOUNT_TYPES } from "../../data/mockData.js";
import { Button, Field, Input, Select } from "../ui/primitives.jsx";

const EMPTY_ACCOUNT = { name: "", type: "banco", balance: "" };

export function AccountForm({ onSuccess, submitLabel = "Guardar cuenta" }) {
  const state = useFinanceState();
  const dispatch = useFinanceDispatch();
  const [form, setForm] = useState(EMPTY_ACCOUNT);

  function handleSubmit(event) {
    event.preventDefault();
    const enteredBalance = Number(form.balance);
    if (!form.name.trim() || !Number.isFinite(enteredBalance) || enteredBalance < 0) return;

    const balance = form.type === "tarjeta_credito" ? -Math.abs(enteredBalance) : enteredBalance;
    dispatch({
      type: "ADD_ACCOUNT",
      payload: { ...form, name: form.name.trim(), balance, currency: state.profile.currency },
    });
    setForm(EMPTY_ACCOUNT);
    onSuccess?.();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <Field label="Nombre">
        <Input
          value={form.name}
          onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
          placeholder="Ej. Banco Mercantil"
          required
        />
      </Field>
      <Field label="Tipo">
        <Select
          value={form.type}
          onChange={(event) => setForm((current) => ({ ...current, type: event.target.value }))}
        >
          {ACCOUNT_TYPES.map((type) => (
            <option key={type.id} value={type.id}>{type.name}</option>
          ))}
        </Select>
      </Field>
      <Field
        label={`${form.type === "tarjeta_credito" ? "Saldo utilizado" : "Saldo actual"} (${state.profile.currency === "USD" ? "USD" : "Bs"})`}
      >
        <Input
          type="number"
          min="0"
          step="0.01"
          value={form.balance}
          onChange={(event) => setForm((current) => ({ ...current, balance: event.target.value }))}
          required
        />
      </Field>
      <Button type="submit" className="mt-1">{submitLabel}</Button>
    </form>
  );
}

