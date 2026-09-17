import React, { useState } from "react";
import { useFinanceDispatch, useFinanceState } from "../../context/FinanceContext.jsx";
import { addMonths, localDateString, parseDate } from "../../services/financial/format.js";
import { Button, Field, Input, Select , MoneyInput } from "../ui/primitives.jsx";
import { fmtBs } from "../../services/financial/format.js";
import { reservedInAccount } from "../../services/financial/savingsFunding.js";
import { profileToday } from "../../services/financial/movementDates.js";

function buildInitialForm(state, type, transaction) {
  if (transaction) return {
    description: transaction.description || "", amount: String(transaction.amount || ""), date: localDateString(transaction.date),
    category: transaction.category || "", accountId: transaction.accountId || "", paymentMethod: transaction.paymentMethod || "", type: transaction.type,
  };
  return { description: "", amount: "", date: profileToday(state.profile), category: state.categories.find((category) => category.type === type && !category.system && !category.archived)?.id || "", accountId: state.accounts.find(account=>account.type !== "tarjeta_credito")?.id || state.accounts[0]?.id || "", paymentMethod: state.paymentMethods[0]?.id || "", type };
}

export function TransactionForm({ initialType = "gasto", lockType = false, transaction = null, prefill = {}, onSuccess, submitLabel }) {
  const state = useFinanceState();
  const dispatch = useFinanceDispatch();
  const [form, setForm] = useState(() => ({ ...buildInitialForm(state, initialType, transaction), ...(transaction ? { planMonth:transaction.planMonth, planItemId:transaction.planItemId, completesCommitment:transaction.completesCommitment, linkedDebtId:transaction.linkedDebtId, linkedCreditCardId:transaction.linkedCreditCardId, savingsFunding:transaction.savingsFunding || null } : prefill) }));
  const [requestId]=useState(()=>`movement-${crypto.randomUUID()}`);
  const [error, setError] = useState("");
  const [recurring, setRecurring] = useState(false);
  const editing = Boolean(transaction);
  const availableCategories = state.categories.filter((category) => category.type === form.type && !category.system && (!category.archived || category.id === form.category));
  const fixedItems=(state.monthlyPlans || []).filter(plan=>plan.month <= form.date.slice(0,7)).flatMap(plan=>plan.expenses.filter(item=>item.classification === "fijo").map(item=>({...item,month:plan.month})));
  function linkCommitment(value) {
    const selected=fixedItems.find(item=>`${item.month}:${item.id}` === value);
    const card=state.accounts.some(account=>account.id === selected?.linkedObligationId && account.type === "tarjeta_credito");
    setForm(current=>({...current,planMonth:selected?.month || null,planItemId:selected?.id || null,completesCommitment:false,...(selected ? {category:selected.categoryId,linkedDebtId:card ? null : selected.linkedObligationId || null,linkedCreditCardId:card ? selected.linkedObligationId : null} : {})}));
  }

  function changeType(type) {
    setForm((current) => ({ ...current, type, category: state.categories.find((category) => category.type === type && !category.system && !category.archived)?.id || "" }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const movementAmount = Number(form.amount);
    if (!form.description.trim() || !Number.isFinite(movementAmount) || movementAmount <= 0 || !form.accountId || !form.date) return;
    let result;
    if (editing) {
      result = await dispatch({ type: "UPDATE_TRANSACTION", payload: { id: transaction.id, ...form, description: form.description.trim(), amount: movementAmount } });
    } else {
      const recurringId = recurring ? `rec-${Date.now()}-${Math.floor(Math.random() * 10000)}` : null;
      if (recurringId) {
        const date = parseDate(form.date);
        result = await dispatch({
          type: "ADD_TRANSACTION_WITH_RECURRENCE",
          payload: {
            transaction: { ...form, requestId, description: form.description.trim(), amount: movementAmount, recurringId },
            recurrence: { id: recurringId, kind: form.type, name: form.description.trim(), category: form.category, amount: movementAmount, frequency: "mensual", dayOfMonth: date.getDate(), nextDate: localDateString(addMonths(date, 1)), active: true },
          },
        });
      } else {
        result = await dispatch({ type: "ADD_TRANSACTION", payload: { ...form, requestId, description: form.description.trim(), amount: movementAmount, recurringId: null } });
      }
      if (result?.ok !== false) setForm(buildInitialForm(state, form.type));
    }
    if (result?.ok === false) { setError(result.error || "No se pudo guardar el movimiento."); return; }
    onSuccess?.(form.type);
  }

  if (state.accounts.length === 0) return <div className="rounded border border-dashed border-line bg-paper-raised p-4 text-sm text-ink-soft">Añade una cuenta antes de registrar un movimiento.</div>;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      {!lockType && !form.planItemId && !form.linkedDebtId && !form.linkedCreditCardId ? <div className="grid grid-cols-2 gap-2" role="group" aria-label="Tipo de movimiento"><Button type="button" variant={form.type === "ingreso" ? "primary" : "secondary"} onClick={() => changeType("ingreso")}>Ingreso</Button><Button type="button" variant={form.type === "gasto" ? "primary" : "secondary"} onClick={() => changeType("gasto")}>Gasto</Button></div> : null}
      <Field label="Descripción"><Input value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} placeholder={form.type === "ingreso" ? "Sueldo mensual" : "Ej. Supermercado"} required /></Field>
      {form.type==="gasto" && !form.planItemId && fixedItems.filter(item=>item.categoryId===form.category && item.month===form.date.slice(0,7)).length===1 ? <button type="button" className="text-xs underline text-left" onClick={()=>{const item=fixedItems.find(item=>item.categoryId===form.category && item.month===form.date.slice(0,7));linkCommitment(`${item.month}:${item.id}`);}}>Vincular al único pago compatible: {fixedItems.find(item=>item.categoryId===form.category && item.month===form.date.slice(0,7))?.name}</button> : null}
      {form.type === "gasto" && fixedItems.length ? <Field label="¿A qué pago corresponde? — Opcional"><Select value={form.planItemId ? `${form.planMonth}:${form.planItemId}` : ""} onChange={event=>linkCommitment(event.target.value)}><option value="">Sin vínculo; el gasto igualmente cuenta en su categoría</option>{fixedItems.map(item=><option key={`${item.month}:${item.id}`} value={`${item.month}:${item.id}`}>{item.month} · {item.name || item.categorySnapshot?.name}</option>)}</Select></Field> : null}
      {form.planItemId ? <div className="rounded bg-paper-raised p-3 text-sm"><p>Pago vinculado al compromiso de {form.planMonth}. Solo se descontará una vez.</p><label className="flex items-center gap-2 mt-2"><input type="checkbox" checked={Boolean(form.completesCommitment)} onChange={event=>setForm({...form,completesCommitment:event.target.checked})} />Este pago completa el compromiso, aunque el monto sea distinto del estimado</label></div> : null}
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label={`Monto (${state.profile.currency === "USD" ? "USD" : "Bs"})`}><MoneyInput currency={state.profile.currency} type="number" min="0.01" step="0.01" value={form.amount} onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))} required /></Field>
        <Field label="Fecha"><Input type="date" max={profileToday(state.profile)} value={form.date} onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))} required /></Field>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Categoría"><Select value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}>{availableCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</Select></Field>
        <Field label="Cuenta desde la que pagas"><Select value={form.accountId} onChange={(event) => setForm((current) => ({ ...current, accountId: event.target.value, savingsFunding:null }))}>{state.accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</Select></Field>
      </div>
      {form.type === "gasto" ? <div className="rounded border border-line p-3 flex flex-col gap-2">
        <Field label="Dinero que utilizas"><Select value={form.savingsFunding?.goalId || ""} onChange={event=>setForm(current=>({...current,savingsFunding:event.target.value ? {goalId:event.target.value,accountId:current.accountId,amount:Math.min(Number(current.amount)||0, state.savingsAllocations.find(row=>row.goalId===event.target.value && row.accountId===current.accountId)?.amount || 0),goalName:state.goals.find(goal=>goal.id===event.target.value)?.name} : null}))}>
          <option value="">Dinero libre</option>{state.goals.filter(goal=>!goal.archived && ((state.savingsAllocations || []).some(row=>row.goalId===goal.id && row.accountId===form.accountId && row.amount>0) || transaction?.savingsFunding?.goalId===goal.id)).map(goal=><option key={goal.id} value={goal.id}>{goal.name} · {fmtBs((state.savingsAllocations.find(row=>row.goalId===goal.id && row.accountId===form.accountId)?.amount || 0)+(transaction?.accountId===form.accountId && transaction?.savingsFunding?.goalId===goal.id ? transaction.savingsFunding.amount : 0),state.profile.currency)} apartados aquí</option>)}
        </Select></Field>
        {form.savingsFunding ? <><Field label="Parte pagada con el plan"><MoneyInput currency={state.profile.currency} type="number" min="0.01" step="0.01" max={form.amount} required value={form.savingsFunding.amount} onChange={event=>setForm(current=>({...current,savingsFunding:{...current.savingsFunding,amount:Number(event.target.value)}}))} /></Field><p className="text-xs">Del plan: {fmtBs(form.savingsFunding.amount,state.profile.currency)} · Dinero libre: {fmtBs(Math.max(0,Number(form.amount)-form.savingsFunding.amount),state.profile.currency)}. No se moverá dinero desde otra cuenta.</p></> : <p className="text-xs">Libre en esta cuenta: {fmtBs((state.accounts.find(row=>row.id===form.accountId)?.balance || 0)-reservedInAccount(state,form.accountId),state.profile.currency)}.</p>}
      </div> : null}
      <Field label="Método de pago"><Select value={form.paymentMethod} onChange={(event) => setForm((current) => ({ ...current, paymentMethod: event.target.value }))}>{state.paymentMethods.map((method) => <option key={method.id} value={method.id}>{method.name}</option>)}</Select></Field>
      {!editing ? <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={recurring} onChange={(event) => setRecurring(event.target.checked)} /> Repetir mensualmente y usar en proyecciones</label> : null}
      {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
      <Button type="submit" className="mt-1">{submitLabel || (editing ? "Guardar cambios" : "Guardar")}</Button>
    </form>
  );
}
