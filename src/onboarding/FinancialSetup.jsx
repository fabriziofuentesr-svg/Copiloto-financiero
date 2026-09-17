import React, { useState } from "react";
import { CheckCircle2, WalletCards } from "lucide-react";
import { useFinanceState, useFinanceDispatch } from "../context/FinanceContext.jsx";
import { AccountForm } from "../components/finance/AccountForm.jsx";
import { Button, Card, Field, MoneyInput } from "../components/ui/primitives.jsx";
import { fmtBs } from "../services/financial/format.js";

export function FinancialSetup({ onBack, onContinue }) {
  const state = useFinanceState();
  const dispatch=useFinanceDispatch();
  const [amounts,setAmounts]=useState({});
  const [error,setError]=useState("");
  const hasAccount = state.accounts.length > 0;
  return (
    <div className="min-h-screen px-4 sm:px-6 py-8 sm:py-12">
      <div className="w-full max-w-3xl mx-auto">
        <div className="text-center mb-6">
          <p className="text-xs font-medium text-teal uppercase tracking-wide">Paso 2 de 2 · Configuración inicial</p>
          <h1 className="font-display text-2xl sm:text-3xl font-semibold mt-2">Cuentas y saldos</h1>
          <p className="text-ink-soft text-sm mt-2 max-w-xl mx-auto">Añade al menos una cuenta para establecer tu punto de partida. Si tiene saldo, se registrará un movimiento “Saldo inicial” sin contarlo como ingreso mensual.</p>
        </div>
        <Card>
          <div className="grid md:grid-cols-[1fr_0.9fr] gap-6">
            <div><h2 className="font-display text-lg font-semibold">Añade una cuenta</h2><p className="text-ink-soft text-sm mt-1 mb-4">Indica todo tu efectivo y el saldo total real de cada cuenta bancaria, incluyendo el dinero que ya tienes apartado. Puedes añadir varias cuentas y usar Bs. 0 en cualquiera.</p><AccountForm submitLabel="Añadir cuenta" /></div>
            <div className="border-t md:border-t-0 md:border-l border-line pt-5 md:pt-0 md:pl-6">
              <h3 className="font-medium text-sm flex items-center gap-2"><WalletCards size={16} /> Tus cuentas</h3>
              <div className="flex flex-col gap-2 mt-3">{state.accounts.length === 0 ? <p className="text-ink-soft text-sm">Todavía no añadiste ninguna cuenta.</p> : state.accounts.map((account) => <div key={account.id} className="flex justify-between gap-3 rounded bg-paper-raised p-3 text-sm"><span className="flex items-center gap-2"><CheckCircle2 size={15} className="text-teal" />{account.name}</span><span className="font-medium tabular-nums">{fmtBs(Math.abs(account.balance), state.profile.currency)}</span></div>)}</div>
            </div>
          </div>
        </Card>
        {hasAccount && !state.goals.some(goal=>goal.initialSavingsConfirmed) ? <Card title="Ahorros que ya tienes"><p className="text-sm mb-3">Indica cuánto de tus saldos ya está apartado como ahorro. No lo sumaremos otra vez. Puedes indicar cero en todas las cuentas.</p>{state.accounts.filter(account=>account.type!=="tarjeta_credito").map(account=><Field key={account.id} label={`Ya apartado en ${account.name}`}><MoneyInput currency={state.profile.currency} type="number" min="0" max={Math.max(0,account.balance)} step="0.01" value={amounts[account.id] || 0} onChange={event=>setAmounts({...amounts,[account.id]:event.target.value})} /></Field>)}<Button className="mt-3" onClick={async()=>{const result=await dispatch({type:"SAVE_INITIAL_SAVINGS",payload:{allocations:state.accounts.filter(account=>account.type!=="tarjeta_credito").map(account=>({accountId:account.id,amount:Number(amounts[account.id] || 0)}))}});if(result?.ok===false)setError(result.error);}}>Confirmar dinero apartado</Button>{error ? <p role="alert">{error}</p> : null}</Card> : null}
        {!hasAccount ? <p className="text-center text-xs text-ink-soft mt-4">Necesitas al menos una cuenta para continuar.</p> : null}
        <div className="flex items-center justify-between gap-3 mt-5"><Button variant="secondary" onClick={onBack}>Atrás</Button><Button disabled={!hasAccount || !state.profile.initialSavingsConfirmed} onClick={onContinue}>Finalizar configuración</Button></div>
      </div>
    </div>
  );
}
