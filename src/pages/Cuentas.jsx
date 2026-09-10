import React, { useState } from "react";
import { Plus } from "lucide-react";
import { useFinanceState, useFinanceDispatch } from "../context/FinanceContext.jsx";
import { Card, Button, Modal, Field, Input, Select } from "../components/ui/primitives.jsx";
import { AccountCard } from "../components/finance/cards.jsx";
import { ACCOUNT_TYPES } from "../data/mockData.js";
import { fmtBs } from "../services/financial/format.js";

const emptyForm = { name: "", type: "banco", balance: "" };

export default function Cuentas() {
  const state = useFinanceState();
  const dispatch = useFinanceDispatch();
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const totalActivos = state.accounts.filter((a) => a.type !== "tarjeta_credito").reduce((s, a) => s + a.balance, 0);
  const totalDeudaTarjetas = state.accounts.filter((a) => a.type === "tarjeta_credito").reduce((s, a) => s + Math.abs(a.balance), 0);

  function guardar(e) {
    e.preventDefault();
    if (!form.name || form.balance === "") return;
    const enteredBalance = Number(form.balance);
    if (!Number.isFinite(enteredBalance) || enteredBalance < 0) return;
    const balance = form.type === "tarjeta_credito" ? -Math.abs(enteredBalance) : enteredBalance;
    dispatch({ type: "ADD_ACCOUNT", payload: { ...form, balance, currency: state.profile.currency } });
    setForm(emptyForm);
    setModalOpen(false);
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="font-display text-2xl font-semibold">Cuentas</h1>
        <Button size="sm" onClick={() => setModalOpen(true)}>
          <Plus size={14} /> Agregar cuenta
        </Button>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <Card>
          <div className="text-ink-soft text-xs">Total en tus cuentas</div>
          <div className="font-display text-2xl font-semibold text-teal">{fmtBs(totalActivos, state.profile.currency)}</div>
        </Card>
        <Card>
          <div className="text-ink-soft text-xs">Deuda en tarjetas de crédito</div>
          <div className="font-display text-2xl font-semibold text-brick">{fmtBs(totalDeudaTarjetas, state.profile.currency)}</div>
        </Card>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {state.accounts.map((a) => (
          <AccountCard key={a.id} account={a} currency={state.profile.currency} onDelete={() => dispatch({ type: "DELETE_ACCOUNT", payload: a.id })} />
        ))}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Nueva cuenta">
        <form onSubmit={guardar} className="flex flex-col gap-3">
          <Field label="Nombre">
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ej. Cuenta BNB" required />
          </Field>
          <Field label="Tipo">
            <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              {ACCOUNT_TYPES.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </Select>
          </Field>
          <Field label={form.type === "tarjeta_credito" ? `Saldo utilizado (${state.profile?.currency === "USD" ? "USD" : "Bs"})` : `Saldo actual (${state.profile?.currency === "USD" ? "USD" : "Bs"})`}>
            <Input type="number" min="0" step="0.01" value={form.balance} onChange={(e) => setForm({ ...form, balance: e.target.value })} required />
          </Field>
          <Button type="submit" className="mt-2">Guardar</Button>
        </form>
      </Modal>

      <p className="text-ink-soft text-xs">
        Este prototipo todavía no se conecta a tu banco de forma real: los saldos se registran manualmente. La
        arquitectura está lista para agregar esa integración más adelante.
      </p>
    </div>
  );
}

