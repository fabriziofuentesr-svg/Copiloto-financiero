import { buildTransfer } from "./ledger.js";
import { profileToday } from "./movementDates.js";
import { localDateString } from "./format.js";
import { money } from "./monthlyPlan.js";
import { calculateAvailableMoney } from "./calculations.js";
import { goalUsed } from "./savingsFunding.js";

// One atomic domain operation shared by Movimientos and Planes de Ahorro.
export function applySavingsOperation(state, payload, uid, now = new Date()) {
  if (payload.requestId && (state.processedRequestIds || []).includes(payload.requestId)) return state;
  const amount=money(payload.amount);
  const goal=state.goals.find(goal=>goal.id === payload.goalId);
  const account=state.accounts.find(account=>account.id === payload.accountId && account.type !== "tarjeta_credito");
  if (!goal || goal.archived || !account || !(amount>0) || !["protect","transfer","release","reconcile","move"].includes(payload.method)) throw new Error("Selecciona un plan, una cuenta y un monto válido.");
  const allocations=state.savingsAllocations || [];
  const existing=allocations.find(item=>item.goalId === goal.id && item.accountId === account.id);
  const allocated=allocations.filter(item=>item.accountId === account.id).reduce((total,item)=>total+money(item.amount),0);
  let accounts=state.accounts;
  let transactions=state.transactions;
  let destinationId=account.id;
  if (["release","move"].includes(payload.method)) {
    if (amount > money(existing?.amount)) throw new Error("Solo puedes liberar dinero vinculado a este plan y cuenta.");
  } else {
    const remaining=payload.method === "reconcile" ? money(goal.current-allocations.filter(item=>item.goalId === goal.id).reduce((total,item)=>total+item.amount,0)) : goal.system === "standard_savings" ? Infinity : money(goal.target-goal.current-goalUsed(state,goal.id));
    if (amount > remaining) throw new Error(payload.method === "reconcile" ? "El monto supera el avance anterior todavía sin vincular." : "El aporte supera lo que falta para el plan.");
    if (amount > money(account.balance-allocated)) throw new Error("La cuenta no tiene suficiente dinero libre.");
    if(payload.method !== "reconcile" && amount > Math.max(0,calculateAvailableMoney(state,now).available)) throw new Error("El aporte supera el dinero libre después de compromisos próximos.");
  }
  if (["transfer","move"].includes(payload.method)) {
    const destination=state.accounts.find(item=>item.id === payload.destinationAccountId && item.type !== "tarjeta_credito");
    if (!destination || destination.id === account.id) throw new Error("Selecciona una cuenta real diferente.");
    const transfer=buildTransfer({fromAccountId:account.id,toAccountId:destination.id,amount,date:profileToday(state.profile,now)},accounts,uid,now);
    if (!transfer) throw new Error("No se pudo registrar la transferencia.");
    accounts=accounts.map(item=>item.id === account.id ? {...item,balance:money(item.balance-amount)} : item.id === destination.id ? {...item,balance:money(item.balance+amount)} : item);
    transactions=[transfer.incoming,transfer.outgoing,...transactions];
    destinationId=destination.id;
  }
  const baseAllocations=payload.method === "move" ? allocations.map(row=>row.goalId === goal.id && row.accountId === account.id ? {...row,amount:money(row.amount-amount)} : row) : allocations;
  const allocation=baseAllocations.find(item=>item.goalId === goal.id && item.accountId === destinationId);
  const delta=payload.method === "release" ? -amount : amount;
  const nextAllocations=baseAllocations.filter(item=>!(item.goalId === goal.id && item.accountId === destinationId));
  nextAllocations.push({goalId:goal.id,accountId:destinationId,amount:money((allocation?.amount || 0)+delta)});
  const event={id:uid("saving"),kind:"goal",linkedGoalId:goal.id,goalName:goal.name,accountId:destinationId,sourceAccountId:account.id,amount,method:payload.method,date:profileToday(state.profile,now),origin:"user",planMonth:payload.planMonth || null};
  return {...state,accounts,transactions,savingsAllocations:nextAllocations.filter(item=>item.amount>0),goals:state.goals.map(item=>item.id === goal.id ? {...item,current:money(item.current+(["reconcile","move"].includes(payload.method) ? 0 : delta))} : item),savingsContributions:[...state.savingsContributions,event],processedRequestIds:payload.requestId ? [...state.processedRequestIds,payload.requestId] : state.processedRequestIds};
}
