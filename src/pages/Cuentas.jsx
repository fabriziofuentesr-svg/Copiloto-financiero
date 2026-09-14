import React, { useState } from "react";
import { Plus } from "lucide-react";
import { useFinanceState, useFinanceDispatch } from "../context/FinanceContext.jsx";
import { Card, Button, Modal } from "../components/ui/primitives.jsx";
import { AccountCard } from "../components/finance/cards.jsx";
import { AccountForm } from "../components/finance/AccountForm.jsx";
import { fmtBs } from "../services/financial/format.js";
import { SectionGuide } from "../components/SectionGuide.jsx";

export default function Cuentas() {
  const state = useFinanceState();
  const dispatch = useFinanceDispatch();
  const [modalOpen, setModalOpen] = useState(false);

  const totalActivos = state.accounts.filter((a) => a.type !== "tarjeta_credito").reduce((s, a) => s + a.balance, 0);
  const totalDeudaTarjetas = state.accounts.filter((a) => a.type === "tarjeta_credito").reduce((s, a) => s + Math.abs(a.balance), 0);

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
        <AccountForm onSuccess={() => setModalOpen(false)} />
      </Modal>

      <p className="text-ink-soft text-xs">
        Este prototipo todavía no se conecta a tu banco de forma real: los saldos se registran manualmente. La
        arquitectura está lista para agregar esa integración más adelante.
      </p>
      <SectionGuide section="accounts" />
    </div>
  );
}
