import React, { useRef, useState } from "react";
import { useFinanceDispatch, useFinanceState } from "../../context/FinanceContext.jsx";
import { ACCOUNT_TYPES } from "../../data/mockData.js";
import { Button, Field, Input, Select } from "../ui/primitives.jsx";

const EMPTY_ACCOUNT = { name: "", type: "efectivo", balance: "", creditLimit: "", statementDay: "", paymentDay: "", minimumPayment: "", rate: "" };

function initialForm(account) {
  if (!account) return EMPTY_ACCOUNT;
  return {
    name: account.name || "",
    type: account.type || "efectivo",
    balance: String(Math.abs(Number(account.balance) || 0)),
    creditLimit: account.creditLimit ?? "",
    statementDay: account.statementDay ?? "",
    paymentDay: account.paymentDay ?? "",
    minimumPayment: account.minimumPayment ?? "",
    rate: account.rate ?? "",
  };
}

export function AccountForm({ account = null, onSuccess, submitLabel }) {
  const state = useFinanceState();
  const dispatch = useFinanceDispatch();
  const [form, setForm] = useState(() => initialForm(account));
  const requestId = useRef(globalThis.crypto?.randomUUID?.() || `account-${Date.now()}-${Math.random()}`);
  const isEditing = Boolean(account);
  const isCard = form.type === "tarjeta_credito";

  function handleSubmit(event) {
    event.preventDefault();
    const balance = Number(form.balance);
    const creditLimit = Number(form.creditLimit || 0);
    const minimumPayment = Number(form.minimumPayment || 0);
    if (!form.name.trim() || !Number.isFinite(balance) || balance < 0) return;
    if (isCard && ((creditLimit > 0 && creditLimit < balance) || minimumPayment < 0 || minimumPayment > balance)) return;

    const payload = {
      name: form.name.trim(), type: form.type, balance, currency: state.profile.currency,
      creditLimit: isCard ? creditLimit || null : null,
      statementDay: isCard ? Number(form.statementDay) || null : null,
      paymentDay: isCard ? Number(form.paymentDay) || null : null,
      minimumPayment: isCard ? minimumPayment || null : null,
      rate: isCard ? Number(form.rate) || null : null,
    };
    if (isEditing) {
      dispatch({ type: "UPDATE_ACCOUNT_METADATA", payload: { id: account.id, ...payload } });
      dispatch({ type: "ADJUST_ACCOUNT_BALANCE", payload: { id: account.id, balance } });
    } else {
      dispatch({ type: "CREATE_ACCOUNT", payload: { ...payload, requestId: requestId.current } });
      setForm(EMPTY_ACCOUNT);
    }
    onSuccess?.();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <Field label="Nombre"><Input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="Ej. Efectivo principal" required /></Field>
      <Field label="Tipo">
        <Select value={form.type} onChange={(event) => setForm((current) => ({ ...current, type: event.target.value }))}>
          {account?.type === "banco" ? <option value="banco">Banco (cuenta heredada)</option> : null}
          {ACCOUNT_TYPES.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}
        </Select>
      </Field>
      <Field label={`${isCard ? "Saldo utilizado" : "Saldo actual"} (${state.profile.currency === "USD" ? "USD" : "Bs"})`}>
        <Input type="number" min="0" step="0.01" value={form.balance} onChange={(event) => setForm((current) => ({ ...current, balance: event.target.value }))} required />
      </Field>
      {isEditing ? <p className="text-xs text-ink-soft">Si cambias el saldo, se creará un ajuste visible en Movimientos para conservar el historial.</p> : null}
      {isCard ? (
        <div className="grid sm:grid-cols-2 gap-3 rounded border border-line p-3">
          <Field label="Límite de crédito"><Input type="number" min="0" step="0.01" value={form.creditLimit} onChange={(event) => setForm((current) => ({ ...current, creditLimit: event.target.value }))} /></Field>
          <Field label="Pago mínimo"><Input type="number" min="0" step="0.01" value={form.minimumPayment} onChange={(event) => setForm((current) => ({ ...current, minimumPayment: event.target.value }))} /></Field>
          <Field label="Día de corte"><Input type="number" min="1" max="31" value={form.statementDay} onChange={(event) => setForm((current) => ({ ...current, statementDay: event.target.value }))} /></Field>
          <Field label="Día de pago"><Input type="number" min="1" max="31" value={form.paymentDay} onChange={(event) => setForm((current) => ({ ...current, paymentDay: event.target.value }))} /></Field>
          <Field label="Tasa anual (%)"><Input type="number" min="0" max="300" step="0.01" value={form.rate} onChange={(event) => setForm((current) => ({ ...current, rate: event.target.value }))} /></Field>
        </div>
      ) : null}
      <Button type="submit" className="mt-1">{submitLabel || (isEditing ? "Guardar cambios" : "Guardar cuenta")}</Button>
    </form>
  );
}
