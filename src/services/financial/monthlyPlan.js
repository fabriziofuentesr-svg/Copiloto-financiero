import { localDateString, parseDate, daysBetweenInclusive } from "./format.js";
import { isOperatingTransaction, getTransactionBalanceDelta } from "./ledger.js";

export const money = value => Math.round((Number(value) || 0) * 100) / 100;
export const monthKey = (date = new Date()) => localDateString(date).slice(0, 7);
const sum = items => money(items.reduce((total, item) => total + money(item), 0));
export function validMonth(value) { return /^\d{4}-(0[1-9]|1[0-2])$/.test(value || "") && Number(value.slice(0, 4)) >= 1900; }
export function categorySnapshot(category) { return category ? { id: category.id, name: category.name, type: category.type, classification: category.classification, version: category.version || 1 } : null; }
export function expenseClassification(state,month=monthKey()) {
  const amounts={fijo:0,variable:0,sinClasificar:0};
  for(const tx of state.transactions || []) {
    if(tx.type !== "gasto" || !isOperatingTransaction(tx) || monthKey(tx.date) !== month) continue;
    const classification=tx.categorySnapshot?.classification || state.categories.find(category=>category.id === tx.category)?.classification;
    const key=classification === "fijo" || classification === "variable" ? classification : "sinClasificar";
    amounts[key]=money(amounts[key]+tx.amount);
  }
  return amounts;
}

export function saveMonthlyPlan(state, draft, now = new Date()) {
  if (![draft.incomes,draft.expenses,draft.savings].every(Array.isArray)) throw new Error("El plan debe contener listas válidas de ingresos, gastos y aportes.");
  const previous = (state.monthlyPlans || []).find(plan => plan.month === draft.month);
  if (!validMonth(draft.month) || draft.month < monthKey(now)) throw new Error("Los meses pasados son de consulta. No puedes crear ni editar su plan.");
  if (typeof draft.recordsComplete !== "boolean") throw new Error("Indica si tus registros incluyen todo el mes.");
  if (!["none","unknown","separate","savings"].includes(draft.emergency?.status)) throw new Error("Indica si tienes ahorros para imprevistos.");
  if (["separate","savings"].includes(draft.emergency.status)) {
    const validSource=draft.emergency.sourceType === "goal" ? state.goals.some(goal=>goal.id === draft.emergency.sourceId) : state.accounts.some(account=>account.id === draft.emergency.sourceId && account.type !== "tarjeta_credito");
    if (!validSource || !Number.isFinite(Number(draft.emergency.amount)) || Number(draft.emergency.amount)<0) throw new Error("Selecciona el origen y un monto válido para tus ahorros.");
  }
  if (draft.savings.some(item=>!state.goals.some(goal=>goal.id === item.goalId)) || new Set(draft.savings.map(item=>item.goalId)).size !== draft.savings.length) throw new Error("Selecciona planes de ahorro válidos, sin duplicarlos.");
  const linked=draft.expenses.map(item=>item.linkedObligationId).filter(Boolean);
  if (new Set(linked).size !== linked.length) throw new Error("Vincula cada cuota a un solo compromiso para evitar duplicarla.");
  if (![draft.closingTarget, ...draft.incomes.map(item => item.estimated), ...draft.expenses.map(item => item.estimated), ...draft.savings.map(item => item.estimated)].every(value => value !== "" && Number.isFinite(Number(value)) && Number(value) >= 0)) throw new Error("Ingresa montos válidos mayores o iguales a cero.");
  const normalize = (items, oldItems = []) => items.map(item => {
    const old = oldItems.find(saved => saved.id === item.id);
    const category = state.categories.find(cat => cat.id === item.categoryId);
    if (!category || category.system || category.type !== (draft.incomes.includes(item) ? "ingreso" : "gasto")) throw new Error("Selecciona una categoría válida.");
    const sameCategory=old?.categoryId === item.categoryId;
    return { ...item, estimated: money(item.estimated), originalEstimated: old?.originalEstimated ?? old?.estimated ?? money(item.estimated), categorySnapshot: sameCategory ? old?.categorySnapshot || categorySnapshot(category) : categorySnapshot(category), classification: sameCategory ? old?.classification || category.classification : category.classification };
  });
  const saved = { ...draft, id: previous?.id || `month-${draft.month}`, incomes: normalize(draft.incomes, previous?.incomes), expenses: normalize(draft.expenses, previous?.expenses), savings: draft.savings.map(item => ({...item, estimated:money(item.estimated)})), closingTarget: money(draft.closingTarget), createdAt: previous?.createdAt || now.toISOString(), updatedAt: now.toISOString(), revisions: [...(previous?.revisions || []), ...(previous ? [{updatedAt:previous.updatedAt, incomes:previous.incomes, expenses:previous.expenses, closingTarget:previous.closingTarget, savings:previous.savings}] : [])] };
  if (new Set(saved.incomes.map(item=>item.categoryId)).size !== saved.incomes.length || new Set(saved.expenses.filter(item=>item.classification === "variable").map(item=>item.categoryId)).size !== saved.expenses.filter(item=>item.classification === "variable").length) throw new Error("Usa una sola estimación por categoría variable o de ingreso.");
  return saved;
}

// Account balances are the ledger truth. Allocations identify existing money;
// they never create assets. Savings accounts and their allocations are excluded once.
export function spendingMoney(state) {
  const assets = (state.accounts || []).filter(account=>account.type !== "tarjeta_credito");
  const savings = sum(assets.filter(account=>account.type === "ahorro").map(account=>account.balance));
  const total = sum(assets.map(account=>account.balance));
  const protectedMoney = sum(assets.filter(account=>account.type !== "ahorro").map(account=>Math.min(Math.max(0,money(account.balance)), sum((state.savingsAllocations || []).filter(item=>item.accountId === account.id).map(item=>item.amount)))));
  return { total, savings, protectedMoney, spendable:money(total-savings-protectedMoney) };
}

// Only reconstruct a closed month when every current account reconciles to its
// ledger. Legacy balances without an opening entry remain explicitly unknown.
function closedMonthCash(state,month) {
  // Current card minima and debt balances cannot establish historical unpaid
  // obligations. Preserve actuals, but do not invent a historical free balance.
  if ((state.debts || []).length || state.accounts.some(account=>account.type === "tarjeta_credito")) return null;
  const accounts=[];
  for(const account of state.accounts.filter(item=>item.type !== "tarjeta_credito")) {
    const tx=state.transactions.filter(item=>item.accountId === account.id);
    if (sum(tx.map(getTransactionBalanceDelta)) !== money(account.balance)) return null;
    const first=tx.filter(item=>["initial_balance","migration_balance"].includes(item.origin)).sort((a,b)=>a.date.localeCompare(b.date))[0];
    if(first?.origin === "migration_balance" && monthKey(first.date)>month && (!account.createdAt || monthKey(account.createdAt)<=month)) return null;
    if(first && monthKey(first.date)>month) continue;
    accounts.push({...account,balance:sum(tx.filter(item=>monthKey(item.date)<=month).map(getTransactionBalanceDelta))});
  }
  const allocations=new Map();
  for(const event of state.savingsContributions || []) {
    if(!event.accountId || !event.linkedGoalId || monthKey(event.date)>month) continue;
    const key=`${event.accountId}:${event.linkedGoalId}`;
    allocations.set(key,{accountId:event.accountId,goalId:event.linkedGoalId,amount:money((allocations.get(key)?.amount || 0)+(event.method === "release" ? -event.amount : event.amount))});
  }
  return spendingMoney({...state,accounts,savingsAllocations:[...allocations.values()].filter(item=>item.amount>0)});
}

function expenseStatus(state, plan, item) {
  const tx = (state.transactions || []).filter(tx=>tx.type === "gasto" && isOperatingTransaction(tx) && monthKey(tx.date) === plan.month && (item.classification === "fijo" ? (tx.planItemId === item.id && tx.planMonth === plan.month) || (!tx.planItemId && item.linkedObligationId && (tx.linkedDebtId === item.linkedObligationId || tx.linkedCreditCardId === item.linkedObligationId || state.debts.find(debt=>debt.id === tx.linkedDebtId)?.linkedAccountId === item.linkedObligationId)) : tx.category === item.categoryId && tx.categorySnapshot?.classification !== "fijo" && !tx.planItemId));
  const actual = sum(tx.map(tx=>tx.amount));
  const completed = item.classification === "fijo" && (tx.some(tx=>tx.completesCommitment) || (actual>0 && actual>=item.estimated));
  const pending = completed ? 0 : Math.max(0,money(item.estimated-actual));
  const used = item.estimated > 0 ? actual/item.estimated : actual > 0 ? Infinity : 0;
  return {...item,actual,pending,completed,difference:money(actual-item.estimated),remaining:Math.max(0,money(item.estimated-actual)),used,alert:item.classification === "variable" ? actual > item.estimated ? "superado" : actual === item.estimated && actual > 0 ? "alcanzado" : used >= .85 ? "cerca" : null : null};
}

export function monthlyPlanStatus(state, selectedMonth = monthKey(), now = new Date()) {
  const plan = (state.monthlyPlans || []).find(plan=>plan.month === selectedMonth);
  let cash = spendingMoney(state);
  if (!plan) return {available:false,missing:["el Plan del mes"],confidence:"insuficiente",cash,month:selectedMonth};
  const currentMonth = monthKey(now);
  const historicalCash=selectedMonth < currentMonth ? closedMonthCash(state,selectedMonth) : null;
  if(historicalCash) cash=historicalCash;
  const tx = (state.transactions || []).filter(tx=>isOperatingTransaction(tx) && monthKey(tx.date) === selectedMonth);
  const incomes = plan.incomes.map(item=>{const actual=sum(tx.filter(tx=>tx.type === "ingreso" && tx.category === item.categoryId).map(tx=>tx.amount)); return {...item,actual,pending:Math.max(0,money(item.estimated-actual)),difference:money(actual-item.estimated)};});
  const expenses = plan.expenses.map(item=>expenseStatus(state,plan,item));
  const overdue = (state.monthlyPlans || []).filter(old=>old.month < selectedMonth).flatMap(old=>old.expenses.filter(item=>item.classification === "fijo").map(item=>{
    const linked=(state.transactions || []).filter(tx=>tx.type === "gasto" && monthKey(tx.date)<=selectedMonth && tx.planMonth === old.month && tx.planItemId === item.id);
    return {...item,id:`${old.month}-${item.id}`,planMonth:old.month,pending:linked.some(tx=>tx.completesCommitment) ? 0 : Math.max(0,money(item.estimated-sum(linked.map(tx=>tx.amount))))};
  })).filter(item=>item.pending > 0);
  const savings = plan.savings.map(item=>{const actual=sum((state.savingsContributions || []).filter(event=>event.method !== "reconcile" && event.linkedGoalId === item.goalId && monthKey(event.date) === selectedMonth).map(event=>event.method === "release" ? -event.amount : event.amount)); return {...item,actual,pending:Math.max(0,money(item.estimated-actual))};});
  const cards=(state.accounts || []).filter(account=>account.type === "tarjeta_credito" && money(account.balance) < 0);
  const cardsIds=new Set(cards.map(card=>card.id));
  const obligations=[...cards.map(card=>({id:card.id,name:card.name,amount:card.minimumPayment})), ...(state.debts || []).filter(debt=>money(debt.balance)>0 && !cardsIds.has(debt.linkedAccountId) && !cards.some(card=>card.name.toLowerCase() === debt.name.toLowerCase())).map(debt=>({id:debt.id,name:debt.name,amount:debt.installment}))];
  const debtPending=sum(obligations.filter(debt=>!plan.expenses.some(item=>item.linkedObligationId === debt.id)).map(debt=>Math.max(0,money(debt.amount)-sum(tx.filter(tx=>tx.linkedDebtId === debt.id || tx.linkedCreditCardId === debt.id || state.debts.find(item=>item.id === tx.linkedDebtId)?.linkedAccountId === debt.id).map(tx=>tx.amount)))));
  const incomePending=sum(incomes.map(item=>item.pending));
  const fixedPending=sum(expenses.filter(item=>item.classification === "fijo").map(item=>item.pending));
  const variablePending=sum(expenses.filter(item=>item.classification === "variable").map(item=>item.pending));
  const savingsPending=sum(savings.map(item=>item.pending));
  const overduePending=sum(overdue.map(item=>item.pending));
  const issues=[];
  if (!plan.recordsComplete) issues.push("faltan movimientos desde el inicio del mes");
  if (tx.some(movement=>movement.type === "gasto" && !movement.planItemId && !movement.linkedDebtId && !movement.linkedCreditCardId && plan.expenses.some(item=>item.classification === "fijo" && item.categoryId === movement.category))) issues.push("hay gastos de categorías fijas sin vínculo: edita esos movimientos para asociar cada pago a su compromiso y evitar pendientes duplicados");
  if (selectedMonth > currentMonth) issues.push("el disponible de apertura se actualizará cuando termine el mes anterior");
  if (obligations.some(debt=>debt.amount === null || debt.amount === undefined)) issues.push("faltan montos de cuotas o pagos mínimos");
  if (expenses.some(item=>item.alert === "superado")) issues.push("hay límites superados: revisa si quedan gastos adicionales");
  if (state.accounts.some(account=>sum((state.savingsAllocations || []).filter(item=>item.accountId === account.id).map(item=>item.amount))>Math.max(0,money(account.balance)))) issues.push("hay aportes protegidos sin saldo suficiente en su cuenta");
  const closing=money(cash.spendable+incomePending-fixedPending-variablePending-savingsPending-debtPending-overduePending);
  const [year,month]=selectedMonth.split("-").map(Number);
  const start=selectedMonth === currentMonth ? now : new Date(year,month-1,1);
  const endDate=localDateString(new Date(year,month,0));
  const past=selectedMonth < currentMonth;
  const historicalClosing=historicalCash ? money(cash.spendable-fixedPending-debtPending-overduePending) : null;
  if(past) return {available:Boolean(historicalCash),historical:true,plan,month:selectedMonth,cash,incomes,expenses,savings,overdue,debtPending,incomePending:0,fixedPending,variablePending:0,savingsPending:0,overduePending,closing:historicalClosing,availableToday:spendingMoney(state).spendable,target:plan.closingTarget,targetDifference:historicalClosing === null ? null : money(historicalClosing-plan.closingTarget),confidence:!plan.recordsComplete || !historicalCash ? "baja" : "media",confidenceIssues:!plan.recordsComplete ? ["el usuario indicó que faltaban registros"] : [],missing:historicalCash ? [] : ["el saldo histórico no puede conciliarse con el libro de movimientos"],startDate:localDateString(start),endDate,days:daysBetweenInclusive(start,parseDate(endDate)),actualIncome:sum(tx.filter(tx=>tx.type === "ingreso").map(tx=>tx.amount)),actualExpense:sum(tx.filter(tx=>tx.type === "gasto").map(tx=>tx.amount)),alerts:expenses.filter(item=>item.alert),formula:{initialBalance:cash.spendable,expectedIncome:0,recurringAndDebtCommitments:money(fixedPending+debtPending+overduePending),variableExpenses:0},end:historicalClosing,start:cash.spendable,expectedIncome:0,expectedVariableExpenses:0,commitments:money(fixedPending+debtPending+overduePending),timeline:[]};
  return {available:!past, historical:past,plan,month:selectedMonth,cash,incomes,expenses,savings,overdue,debtPending,incomePending,fixedPending,variablePending,savingsPending,overduePending,closing:past ? null : closing,availableToday:money(cash.spendable-fixedPending-debtPending-overduePending),target:plan.closingTarget,targetDifference:past ? null : money(closing-plan.closingTarget),confidence:issues.length || tx.length < 4 ? "baja" : "media",confidenceIssues:issues,missing:past ? ["el saldo de cierre histórico no fue capturado; consulta los movimientos"] : [],startDate:localDateString(start),endDate,days:daysBetweenInclusive(start,parseDate(endDate)),actualIncome:sum(tx.filter(tx=>tx.type === "ingreso").map(tx=>tx.amount)),actualExpense:sum(tx.filter(tx=>tx.type === "gasto").map(tx=>tx.amount)),alerts:expenses.filter(item=>item.alert),formula:{initialBalance:cash.spendable,expectedIncome:incomePending,recurringAndDebtCommitments:money(fixedPending+debtPending+overduePending+savingsPending),variableExpenses:variablePending},end:past ? null : closing,start:cash.spendable,expectedIncome:incomePending,expectedVariableExpenses:variablePending,commitments:money(fixedPending+debtPending+overduePending+savingsPending),timeline:[]};
}

export function monthlyHealth(state, selectedMonth = monthKey(), now = new Date()) {
  const status=monthlyPlanStatus(state,selectedMonth,now);
  if (!status.plan) return {available:false,missing:["el Plan del mes"],confidence:"insuficiente"};
  const income=status.historical ? status.actualIncome : Math.max(status.actualIncome,sum(status.incomes.map(item=>item.estimated)));
  const cards=state.accounts.filter(account=>account.type === "tarjeta_credito" && account.balance<0);
  const cardIds=new Set(cards.map(account=>account.id));
  const obligations=[...cards.map(account=>({id:account.id,amount:account.minimumPayment})),...state.debts.filter(debt=>debt.balance>0 && !cardIds.has(debt.linkedAccountId) && !cards.some(card=>card.name.toLowerCase() === debt.name.toLowerCase())).map(debt=>({id:debt.id,amount:debt.installment}))];
  const debtMonthly=sum(obligations.map(item=>item.amount))+sum(status.expenses.filter(item=>item.categoryId === "deudas" && !item.linkedObligationId).map(item=>item.estimated));
  const externalMonthly=sum(obligations.filter(debt=>!status.expenses.some(item=>item.linkedObligationId === debt.id)).map(item=>item.amount));
  const expense=status.historical ? status.actualExpense : Math.max(status.actualExpense,sum(status.expenses.map(item=>item.estimated))+externalMonthly);
  const margin=income > 0 ? (income-expense)/income : expense > 0 ? -1 : 0;
  const emergency=status.plan.emergency;
  const source=emergency?.sourceType === "goal" ? state.goals.find(goal=>goal.id === emergency.sourceId) : state.accounts.find(account=>account.id === emergency?.sourceId && account.type !== "tarjeta_credito");
  const backed=emergency?.sourceType === "goal" ? sum((state.savingsAllocations || []).filter(item=>item.goalId === emergency.sourceId).map(item=>Math.min(item.amount,Math.max(0,money(state.accounts.find(account=>account.id === item.accountId)?.balance))))) : money(source?.balance);
  const reserve=emergency?.status === "none" ? 0 : Math.max(0,Math.min(money(emergency?.amount),backed));
  const known=emergency?.status === "none" || (emergency?.status && emergency.status !== "unknown" && Boolean(source));
  const debtKnown=obligations.every(item=>item.amount !== null && item.amount !== undefined);
  const essential=sum(status.expenses.filter(item=>item.categorySnapshot && state.categories.find(category=>category.id === item.categoryId)?.essential).map(item=>item.estimated));
  const weights={flujoCaja:.35,reserva:.25,endeudamiento:.25,planificacion:.15};
  const bounded=value=>Math.round(Math.max(0,Math.min(100,value)));
  const breakdown={
    flujoCaja:{score:bounded(50+margin*100),weight:weights.flujoCaja,reason:`Ingresos ${income}; gastos y cuotas ${expense}; margen ${money(income-expense)}.`,action:margin <= 0 ? "Revisa gastos y cuotas para conservar margen." : "Mantén tus gastos dentro de lo previsto."},
    reserva:{score:known ? bounded(essential>0 ? reserve/essential*100 : reserve>0 ? 70 : 0) : null,weight:weights.reserva,reason:known ? `Ahorros utilizables ante un imprevisto: ${reserve}.${emergency.sourceType === "goal" ? " Usarlos retrasaría el plan de ahorro." : ""}` : "Ahorros para imprevistos no informados.",action:known && reserve === 0 ? "Separa una cantidad cuando tengas disponible real." : "Revisa qué ahorros puedes utilizar."},
    endeudamiento:{score:debtKnown ? bounded(debtMonthly === 0 ? 100 : income>0 ? 100-debtMonthly/income*150 : 0) : null,weight:weights.endeudamiento,reason:`Cuotas mensuales aproximadas: ${debtMonthly}; compromisos pendientes: ${money(status.fixedPending+status.debtPending+status.overduePending)}.${debtKnown ? "" : " Faltan montos de cuotas o pagos mínimos."}`,action:"Registra cada pago y revisa compromisos impagos."},
    planificacion:{score:status.closing === null ? null : bounded(status.cash.spendable>0 ? 50+Math.max(0,Math.min(1,(status.closing || 0)/status.cash.spendable))*50 : 25),weight:weights.planificacion,reason:`Disponible al cierre: ${status.closing ?? "sin saldo histórico conciliable"}. El objetivo elegido no modifica este componente.`,action:"Ajusta tus estimaciones y protege únicamente dinero disponible."},
  };
  const present=Object.values(breakdown).filter(item=>item.score !== null);
  // Five-point bands avoid suggesting single-point accuracy with estimated data.
  const score=Math.round(bounded(present.reduce((total,item)=>total+item.score*item.weight,0)/present.reduce((total,item)=>total+item.weight,0))/5)*5;
  return {available:true,scoreDisplayable:known && debtKnown && status.closing !== null && status.confidence !== "baja",partial:!known || !debtKnown || status.closing === null,score,breakdown,confidence:status.confidence,missing:[...(!known ? ["ahorros utilizables ante imprevistos"] : []),...(!debtKnown ? ["montos de cuotas o pagos mínimos"] : []),...(status.closing === null ? ["saldo de cierre conciliable"] : [])],resumen:status.closing < 0 ? "Los gastos previstos superan el dinero disponible al cierre. Revisa el plan." : !known || !debtKnown ? "Evaluación parcial: revisa los componentes no informados." : reserve === 0 ? "No hay ahorros informados para imprevistos. Revisa también si tus ingresos cubren los gastos." : "Revisa el margen del mes y los compromisos antes de gastar.",margin,dti:income>0 ? debtMonthly/income : null,reserve,essentialMonthly:essential,coverageMonths:essential>0 ? reserve/essential : 0};
}
