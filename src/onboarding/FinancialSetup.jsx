import React, { useState } from "react";
import { ArrowDownCircle, ArrowUpCircle, CheckCircle2, Plus, WalletCards } from "lucide-react";
import { useFinanceState } from "../context/FinanceContext.jsx";
import { AccountForm } from "../components/finance/AccountForm.jsx";
import { TransactionForm } from "../components/finance/TransactionForm.jsx";
import { Button, Card } from "../components/ui/primitives.jsx";
import { fmtBs } from "../services/financial/format.js";

export function FinancialSetup({ onBack, onContinue }) {
  const state = useFinanceState();
  const [panel, setPanel] = useState(state.accounts.length ? "income" : "account");
  const hasAccount = state.accounts.length > 0;
  const incomeCount = state.transactions.filter((transaction) => transaction.type === "ingreso").length;
  const expenseCount = state.transactions.filter((transaction) => transaction.type === "gasto").length;
  const hasMovement = incomeCount + expenseCount > 0;

  return (
    <div className="min-h-screen px-4 sm:px-6 py-8 sm:py-12">
      <div className="w-full max-w-3xl mx-auto">
        <div className="text-center mb-6">
          <p className="text-xs font-medium text-teal uppercase tracking-wide">Configuración inicial</p>
          <h1 className="font-display text-2xl sm:text-3xl font-semibold mt-2">Comencemos con tus finanzas</h1>
          <p className="text-ink-soft text-sm mt-2 max-w-xl mx-auto">
            Para que tu Copiloto pueda ayudarte, necesitamos una primera fotografía de tu situación financiera.
            Empieza con lo esencial y completa el resto cuando quieras.
          </p>
        </div>

        <div className="grid sm:grid-cols-3 gap-3 mb-4">
          <ProgressCard
            icon={WalletCards}
            title="Cuentas y saldos"
            detail={hasAccount ? `${state.accounts.length} cuenta(s) añadida(s)` : "Añade tu primera cuenta"}
            complete={hasAccount}
            active={panel === "account"}
            onClick={() => setPanel("account")}
          />
          <ProgressCard
            icon={ArrowUpCircle}
            title="Primeros ingresos"
            detail={incomeCount ? `${incomeCount} ingreso(s) registrado(s)` : "Registra un ingreso"}
            complete={incomeCount > 0}
            active={panel === "income"}
            onClick={() => setPanel("income")}
          />
          <ProgressCard
            icon={ArrowDownCircle}
            title="Primeros gastos"
            detail={expenseCount ? `${expenseCount} gasto(s) registrado(s)` : "Registra un gasto"}
            complete={expenseCount > 0}
            active={panel === "expense"}
            onClick={() => setPanel("expense")}
          />
        </div>

        <Card>
          {panel === "account" ? (
            <div className="grid md:grid-cols-[1fr_0.9fr] gap-6">
              <div>
                <h2 className="font-display text-lg font-semibold">Añade una cuenta</h2>
                <p className="text-ink-soft text-sm mt-1 mb-4">Indica dónde tienes tu dinero y cuál es su saldo actual.</p>
                <AccountForm submitLabel="+ Añadir cuenta" onSuccess={() => setPanel("income")} />
              </div>
              <div className="border-t md:border-t-0 md:border-l border-line pt-5 md:pt-0 md:pl-6">
                <h3 className="font-medium text-sm">Tus cuentas</h3>
                <div className="flex flex-col gap-2 mt-3">
                  {state.accounts.length === 0 ? (
                    <p className="text-ink-soft text-sm">Todavía no añadiste ninguna cuenta.</p>
                  ) : state.accounts.map((account) => (
                    <div key={account.id} className="flex justify-between gap-3 rounded bg-paper-raised p-3 text-sm">
                      <span>{account.name}</span>
                      <span className="font-medium tabular-nums">{fmtBs(account.balance, state.profile.currency)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : panel === "income" ? (
            <div>
              <h2 className="font-display text-lg font-semibold">Registra tus primeros ingresos</h2>
              <p className="text-ink-soft text-sm mt-1 mb-4">
                Empieza con tu ingreso más habitual. Podrás añadir otros ahora o más adelante.
              </p>
              <TransactionForm initialType="ingreso" lockType submitLabel="Registrar ingreso" onSuccess={() => setPanel("expense")} />
            </div>
          ) : (
            <div>
              <h2 className="font-display text-lg font-semibold">Registra tus primeros gastos</h2>
              <p className="text-ink-soft text-sm mt-1 mb-4">
                Añade uno o varios gastos importantes para comenzar a entender cómo utilizas tu dinero.
              </p>
              <TransactionForm initialType="gasto" lockType submitLabel="Registrar gasto" />
            </div>
          )}
          {hasAccount && panel !== "account" ? (
            <Button variant="ghost" size="sm" className="mt-3" onClick={() => setPanel("account")}>
              <Plus size={14} /> Añadir otra cuenta
            </Button>
          ) : null}
        </Card>

        <p className="text-center text-xs text-ink-soft mt-4">
          Recomendado: añade al menos una cuenta y un movimiento para recibir información útil desde el inicio.
        </p>
        <div className="flex flex-wrap items-center justify-between gap-3 mt-5">
          <Button variant="secondary" onClick={onBack}>Atrás</Button>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onContinue}>Lo haré después</Button>
            <Button onClick={onContinue}>{hasAccount && hasMovement ? "Continuar" : "Omitir por ahora"}</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProgressCard({ icon: Icon, title, detail, complete, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left rounded border p-3 sm:p-4 transition-colors ${active ? "border-teal bg-teal/5" : "border-line bg-paper hover:bg-paper-raised"}`}
    >
      <div className="flex items-center justify-between gap-2">
        <Icon size={18} className="text-teal" />
        {complete ? <CheckCircle2 size={17} className="text-teal" /> : null}
      </div>
      <div className="font-medium text-sm mt-2">{title}</div>
      <div className="text-ink-soft text-xs mt-1">{detail}</div>
    </button>
  );
}
