import React, { useState } from "react";
import { useFinanceDispatch, useFinanceState } from "../../context/FinanceContext.jsx";
import { Button, Field, Input, Select , MoneyInput } from "../ui/primitives.jsx";
import { fmtBs } from "../../services/financial/format.js";

// Both entry points use the same reducer/domain operation, including idempotency.
export function SavingsOperationForm({ goalId, initialAmount = "", onSuccess }) {
  const state=useFinanceState(); const dispatch=useFinanceDispatch();
  const [form,setForm]=useState({goalId:goalId || state.goals[0]?.id || "",accountId:state.accounts.find(a=>a.type !== "tarjeta_credito")?.id || "",destinationAccountId:state.accounts.find(a=>a.type === "ahorro")?.id || "",method:"protect",amount:initialAmount});
  const [requestId]=useState(()=>`saving-${crypto.randomUUID()}`);
  const [error,setError]=useState(""); const [busy,setBusy]=useState(false);
  async function save(event) { event.preventDefault(); setBusy(true); const result=await dispatch({type:"SAVINGS_OPERATION",payload:{...form,amount:Number(form.amount),requestId}}); setBusy(false); if(result?.ok === false) setError(result.error); else onSuccess?.(); }
  return <form onSubmit={save} className="flex flex-col gap-3">
    <p className="text-sm text-ink-soft">Un aporte asigna dinero que ya existe en tus cuentas. No es un gasto ni un ingreso.</p>
    <Field label="Plan de ahorro"><Select value={form.goalId} onChange={e=>setForm({...form,goalId:e.target.value})}><option value="">Selecciona un plan</option>{state.goals.map(goal=><option key={goal.id} value={goal.id}>{goal.name}</option>)}</Select></Field>
    <Field label="Operación"><Select value={form.method} onChange={e=>setForm({...form,method:e.target.value})}><option value="reassign">Reasignar desde Ahorros (no es ahorro nuevo)</option><option value="protect">Proteger dinero en la misma cuenta</option><option value="transfer">Transferir a una cuenta de ahorro y asignarlo</option><option value="release">Liberar una asignación existente</option><option value="reconcile">Vincular avance anterior sin aumentarlo</option></Select></Field>
    <Field label={form.method === "release" ? "Cuenta que guarda el aporte" : "Cuenta de origen"}><Select value={form.accountId} onChange={e=>setForm({...form,accountId:e.target.value})}>{state.accounts.filter(a=>a.type !== "tarjeta_credito").map(a=><option key={a.id} value={a.id}>{a.name} · {fmtBs(a.balance,state.profile.currency)}</option>)}</Select></Field>
    {form.method === "transfer" ? <Field label="Cuenta de ahorro de destino"><Select value={form.destinationAccountId} onChange={e=>setForm({...form,destinationAccountId:e.target.value})}><option value="">Selecciona una cuenta</option>{state.accounts.filter(a=>a.type === "ahorro").map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</Select></Field> : null}
    {form.method === "reconcile" ? <p className="text-xs text-ink-soft">Solo vincula una parte del avance anterior conservado a dinero real de esta cuenta. No aumenta el avance ni cuenta como ahorro nuevo del mes.</p> : null}<Field label="Monto"><MoneyInput currency={state.profile.currency} type="number" min="0.01" step="0.01" required value={form.amount} onChange={e=>setForm({...form,amount:e.target.value})} /></Field>
    {form.method === "release" ? <p className="text-xs text-ink-soft">La liberación reduce el avance del plan. Si el dinero está en una cuenta de ahorro, seguirá fuera del disponible hasta que lo transfieras a una cuenta de uso diario.</p> : null}
    {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
    <Button type="submit" disabled={busy}>{busy ? "Guardando…" : "Confirmar operación"}</Button>
  </form>;
}

export function TransferForm({ onSuccess }) {
  const state=useFinanceState(); const dispatch=useFinanceDispatch();
  const accounts=state.accounts.filter(a=>a.type !== "tarjeta_credito");
  const [form,setForm]=useState({fromAccountId:accounts[0]?.id || "",toAccountId:accounts[1]?.id || "",amount:""});
  const [error,setError]=useState("");
  async function save(event) { event.preventDefault(); const result=await dispatch({type:"TRANSFER_BETWEEN_ACCOUNTS",payload:{...form,amount:Number(form.amount)}}); if(result?.ok === false) setError(result.error); else onSuccess?.(); }
  return <form onSubmit={save} className="flex flex-col gap-3"><p className="text-sm text-ink-soft">Mover dinero entre tus cuentas conserva el total y no altera los ingresos ni los gastos del mes.</p>{[["fromAccountId","Desde"],["toAccountId","Hacia"]].map(([key,label])=><Field key={key} label={label}><Select value={form[key]} onChange={e=>setForm({...form,[key]:e.target.value})}><option value="">Selecciona una cuenta</option>{accounts.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</Select></Field>)}<Field label="Monto"><MoneyInput currency={state.profile.currency} type="number" min="0.01" step="0.01" required value={form.amount} onChange={e=>setForm({...form,amount:e.target.value})} /></Field>{error ? <p role="alert">{error}</p> : null}<Button type="submit">Registrar transferencia</Button></form>;
}
