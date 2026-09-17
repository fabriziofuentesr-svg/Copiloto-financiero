import { profileToday } from "./movementDates.js";
import { money } from "./monthlyPlan.js";

// Associations describe money already in accounts. No ledger entry or new asset.
export function ensureStandardSavings(state) {
  if (!state.profile?.onboardingCompleted && !state.accounts.some(account => account.type === "ahorro")) return state;
  const goals = state.goals || [];
  const existing = goals.find(goal => goal.system === "standard_savings" || goal.name?.trim().toLowerCase() === "ahorros");
  const goal = existing || { id: "standard-savings", name: "Ahorros", target: 0, current: 0, monthlyContribution: 0, contributionFrequency: "mensual" };
  const allocations = (state.savingsAllocations || []).map(item => ({ ...item }));
  const initializedAccountIds = [...(goal.initializedAccountIds || [])];
  let added = 0;
  for (const account of state.accounts.filter(item => item.type === "ahorro")) {
    if (initializedAccountIds.includes(account.id)) continue;
    initializedAccountIds.push(account.id);
    const assigned = allocations.filter(item => item.accountId === account.id).reduce((sum, item) => sum + item.amount, 0);
    const free = Math.max(0, money(account.balance - assigned));
    if (!free) continue;
    const allocation = allocations.find(item => item.accountId === account.id && item.goalId === goal.id);
    if (allocation) allocation.amount = money(allocation.amount + free);
    else allocations.push({ goalId: goal.id, accountId: account.id, amount: free });
    added = money(added + free);
  }
  const backed = allocations.filter(item => item.goalId === goal.id).reduce((sum, item) => sum + item.amount, 0);
  const normalized = { ...goal, name: "Ahorros", target: 0, system: "standard_savings", initializedAccountIds, current: Math.max(money(goal.current), money(backed)) };
  if (existing && !added && existing.system === normalized.system && existing.current === normalized.current && JSON.stringify(goal.initializedAccountIds) === JSON.stringify(initializedAccountIds)) return state;
  return { ...state, goals: existing ? goals.map(item => item.id === goal.id ? normalized : item) : [...goals, normalized], savingsAllocations: allocations };
}

export function reassignSavings(state, payload) {
  if (payload.requestId && state.processedRequestIds?.includes(payload.requestId)) return state;
  const source = state.goals.find(goal => goal.system === "standard_savings");
  const target = state.goals.find(goal => goal.id === payload.goalId && goal.id !== source?.id);
  const amount = money(payload.amount);
  const allocation = state.savingsAllocations.find(item => item.goalId === source?.id && item.accountId === payload.accountId);
  if (!source || !target || !(amount > 0) || amount > money(allocation?.amount) || amount > money(target.target - target.current)) throw new Error("Selecciona ahorros respaldados y un monto que no supere lo que falta para el plan.");
  const allocations = state.savingsAllocations.map(item => ({ ...item }));
  allocations.find(item => item === allocation || (item.goalId === source.id && item.accountId === payload.accountId)).amount = money(allocation.amount - amount);
  const destination = allocations.find(item => item.goalId === target.id && item.accountId === payload.accountId);
  if (destination) destination.amount = money(destination.amount + amount);
  else allocations.push({ goalId: target.id, accountId: payload.accountId, amount });
  const event={id:`reassign-${payload.requestId || crypto.randomUUID()}`,kind:"goal",linkedGoalId:target.id,sourceGoalId:source.id,goalName:target.name,accountId:payload.accountId,amount,method:"reassign",origin:"internal_reassignment",date:profileToday(state.profile)};
  return { ...state, savingsContributions:[...(state.savingsContributions || []),event], savingsAllocations: allocations.filter(item => item.amount > 0), goals: state.goals.map(goal => goal.id === source.id ? { ...goal, current: money(goal.current - amount) } : goal.id === target.id ? { ...goal, current: money(goal.current + amount) } : goal), processedRequestIds: payload.requestId ? [...(state.processedRequestIds || []), payload.requestId] : state.processedRequestIds };
}
