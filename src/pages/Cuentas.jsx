import React, { useState } from "react";
import { Plus } from "lucide-react";
import { useFinanceDispatch, useFinanceState } from "../context/FinanceContext.jsx";
import { AccountForm } from "../components/finance/AccountForm.jsx";
import { AccountCard, AlertBanner } from "../components/finance/cards.jsx";
import { SectionGuide } from "../components/SectionGuide.jsx";
import { Button, Card, Modal } from "../components/ui/primitives.jsx";
import { getCreditCardDebt, getTotalBalance } from "../services/financial/calculations.js";
import { fmtBs } from "../services/financial/format.js";

export default function Cuentas() {
  const state = useFinanceState();
  const dispatch = useFinanceDispatch();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [notice, setNotice] = useState("");

  function deleteAccount(account) {
    const linked = state.transactions.filter((transaction) => transaction.accountId === account.id);
    const userMovements = linked.filter((transaction) => !transaction.generated);
    if (userMovements.length) {
      setNotice(`No se eliminó “${account.name}” porque tiene ${userMovements.length} ${userMovements.length === 1 ? "movimiento" : "movimientos"}. Reasigna o elimina esos movimientos primero.`);
      return;
    }
    if (window.confirm(`¿Eliminar “${account.name}”? También se retirarán sus movimientos generados de saldo inicial o ajuste.`)) dispatch({ type: "DELETE_ACCOUNT", payload: account.id });
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between flex-wrap gap-3"><h1 className="font-display text-2xl font-semibold">Cuentas</h1><Button size="sm" onClick={() => setModalOpen(true)}><Plus size={14} /> Agregar cuenta</Button></div>
      {notice ? <AlertBanner level="warning">{notice}</AlertBanner> : null}
      <div className="grid sm:grid-cols-2 gap-4">
        <Card><div className="text-ink-soft text-xs">Total en cuentas de activo</div><div className="font-display text-2xl font-semibold text-teal">{fmtBs(getTotalBalance(state), state.profile.currency)}</div></Card>
        <Card><div className="text-ink-soft text-xs">Saldo utilizado en tarjetas</div><div className="font-display text-2xl font-semibold text-brick">{fmtBs(getCreditCardDebt(state), state.profile.currency)}</div></Card>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {state.accounts.map((account) => <AccountCard key={account.id} account={account} currency={state.profile.currency} onEdit={() => setEditing(account)} onDelete={() => deleteAccount(account)} />)}
        {!state.accounts.length ? <p className="text-ink-soft text-sm">Añade una cuenta para registrar saldos y movimientos.</p> : null}
      </div>
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Nueva cuenta"><AccountForm onSuccess={() => setModalOpen(false)} /></Modal>
      <Modal open={Boolean(editing)} onClose={() => setEditing(null)} title={`Editar ${editing?.name || "cuenta"}`}><AccountForm key={editing?.id} account={editing} onSuccess={() => setEditing(null)} /></Modal>
      <p className="text-ink-soft text-xs">Los saldos se actualizan con movimientos. Cualquier cambio manual crea un ajuste trazable.</p>
      <SectionGuide section="accounts" />
    </div>
  );
}
