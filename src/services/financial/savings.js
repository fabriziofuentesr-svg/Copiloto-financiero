import { buildTransfer } from "./ledger.js";
import { localDateString } from "./format.js";
import { money } from "./monthlyPlan.js";
import { calculateAvailableMoney } from "./calculations.js";

// One atomic domain operation shared by Movimientos and Planes de Ahorro.
export function applySavingsOperation(state, payload, uid, now = new Date()) {
  if (payload.requestId && state.processedRequestIds.includes(payload.requestId)) return state;
  const amount=money(payload.amount);
  const goal=state.goals.find(goal=>goal.id === payload.goalId);
  const account=state.accounts.find(account=>account.id === payload.accountId && account.type !== "tarjeta_credito");
  if (!goal || !account || !(amount>0) || !["protect","transfer","release","reconcile"].includes(payload.method)) throw new Error("Selecciona un plan, una cuenta y un monto válido.");
  const allocations=state.savingsAllocations || [];
  const existing=allocations.find(item=>item.goalId === goal.id && item.accountId === account.id);
  const allocated=allocations.filter(item=>item.accountId === account.id).reduce((total,item)=>total+money(item.amount),0);
  let accounts=state.accounts;
  let transactions=state.transactions;
  let destinationId=account.id;
  if (payload.method === "release") {
    if (amount > money(existing?.amount)) throw new Error("Solo puedes liberar dinero vinculado a este plan y cuenta.");
  } else {
    const remaining=payload.method === "reconcile" ? money(goal.current-allocations.filter(item=>item.goalId === goal.id).reduce((total,item)=>total+item.amount,0)) : money(goal.target-goal.current);
    if (amount > remaining) throw new Error(payload.method === "reconcile" ? "El monto supera el avance anterior todavía sin vincular." : "El aporte supera lo que falta para el plan.");
    if (amount > money(account.balance-allocated)) throw new Error("La cuenta no tiene suficiente dinero libre.");
    const free=calculateAvailableMoney(state,now).available;
    if (account.type !== "ahorro" && amount > Math.max(0,free)) throw new Error("El aporte debe estar respaldado por dinero disponible después de compromisos.");
  }
  if (payload.method === "transfer") {
    const destination=state.accounts.find(item=>item.id === payload.destinationAccountId && item.type === "ahorro");
    if (!destination || destination.id === account.id) throw new Error("Selecciona una cuenta de ahorro diferente.");
    const transfer=buildTransfer({fromAccountId:account.id,toAccountId:destination.id,amount},accounts,uid,now);
    if (!transfer) throw new Error("No se pudo registrar la transferencia.");
    accounts=accounts.map(item=>item.id === account.id ? {...item,balance:money(item.balance-amount)} : item.id === destination.id ? {...item,balance:money(item.balance+amount)} : item);
    transactions=[transfer.incoming,transfer.outgoing,...transactions];
    destinationId=destination.id;
  }
  const allocation=allocations.find(item=>item.goalId === goal.id && item.accountId === destinationId);
  const delta=payload.method === "release" ? -amount : amount;
  const nextAllocations=allocations.filter(item=>!(item.goalId === goal.id && item.accountId === destinationId));
  nextAllocations.push({goalId:goal.id,accountId:destinationId,amount:money((allocation?.amount || 0)+delta)});
  const event={id:uid("saving"),kind:"goal",linkedGoalId:goal.id,goalName:goal.name,accountId:destinationId,sourceAccountId:account.id,amount,method:payload.method,date:localDateString(now),origin:"user"};
  return {...state,accounts,transactions,savingsAllocations:nextAllocations.filter(item=>item.amount>0),goals:state.goals.map(item=>item.id === goal.id ? {...item,current:money(item.current+(payload.method === "reconcile" ? 0 : delta))} : item),savingsContributions:[...state.savingsContributions,event],processedRequestIds:payload.requestId ? [...state.processedRequestIds,payload.requestId] : state.processedRequestIds};
}
