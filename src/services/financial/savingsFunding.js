import { money } from "./monthlyPlan.js";

export function reservedInAccount(state, accountId) {
  return money((state.savingsAllocations || []).filter(row => row.accountId === accountId).reduce((sum, row) => sum + money(row.amount), 0));
}

export function goalUsed(state, goalId) {
  return money((state.transactions || []).filter(tx => tx.type === "gasto" && tx.savingsFunding?.goalId === goalId).reduce((sum, tx) => sum + money(tx.savingsFunding.amount), 0));
}

// Pure reversal/application: callers commit the whole ledger and allocation
// change together. A failed edit leaves the previous state untouched.
export function applyExpenseFunding(state, tx, direction = 1) {
  if (tx.type !== "gasto") {
    if (tx.savingsFunding?.amount > 0) throw new Error("Solo los gastos pueden utilizar dinero apartado.");
    return state;
  }
  const funding = tx.savingsFunding;
  const amount = money(funding?.amount);
  if(funding && (!Number.isFinite(Number(funding.amount)) || Number(funding.amount)<0)) throw new Error("Indica un monto apartado válido.");
  const account = state.accounts.find(row => row.id === tx.accountId);
  if (!account) throw new Error("La cuenta de pago ya no existe.");
  if (direction > 0 && account.type !== "tarjeta_credito" && money(tx.amount - amount) > money(account.balance - reservedInAccount(state, account.id))) throw new Error("La parte libre del gasto supera el dinero libre de esta cuenta.");
  if (!amount) return state;
  const goal = state.goals.find(row => row.id === funding.goalId);
  const allocation = (state.savingsAllocations || []).find(row => row.goalId === funding.goalId && row.accountId === tx.accountId);
  if (!goal || account.type === "tarjeta_credito" || funding.accountId !== tx.accountId || amount < 0 || amount > money(tx.amount) || (direction > 0 && (goal.archived || amount > money(allocation?.amount)))) throw new Error("El gasto debe usar ahorros suficientes del plan en la cuenta desde la que pagas.");
  const rows = (state.savingsAllocations || []).filter(row => !(row.goalId === goal.id && row.accountId === account.id));
  const remaining = money((allocation?.amount || 0) - direction * amount);
  if (remaining > 0) rows.push({goalId: goal.id, accountId: account.id, amount: remaining});
  return {...state, savingsAllocations: rows, goals: state.goals.map(row => row.id === goal.id ? {...row, current: money(row.current - direction * amount)} : row)};
}
