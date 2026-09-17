import { buildEmptyState, buildDemoState } from "../data/mockData.js";
import { migrateState } from "./migrations.js";
import { buildAccountCreation, buildTransfer, getTransactionBalanceDelta } from "./financial/ledger.js";
import { localDateString } from "./financial/format.js";
import { categorySnapshot, saveMonthlyPlan } from "./financial/monthlyPlan.js";
import { applySavingsOperation } from "./financial/savings.js";
import { changeCategory } from "./categories.js";
import { validateMovementDate, profileToday } from "./financial/movementDates.js";
import { ensureStandardSavings, reassignSavings } from "./financial/standardSavings.js";
import { applyExpenseFunding, reservedInAccount, goalUsed } from "./financial/savingsFunding.js";
function uid(prefix) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

function money(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function linkedPayment(state,tx,direction) {
  if(tx.type !== "gasto" || (!tx.linkedDebtId && !tx.linkedCreditCardId)) return state;
  const debt=state.debts.find(item=>item.id === tx.linkedDebtId);
  const cardId=tx.linkedCreditCardId || debt?.linkedAccountId;
  const card=state.accounts.find(item=>item.id === cardId && item.type === "tarjeta_credito");
  if(!debt && !card) throw new Error("La obligación vinculada ya no existe.");
  if(tx.accountId === cardId) throw new Error("El pago debe salir de una cuenta de dinero disponible.");
  if(direction>0 && tx.amount > (card ? -card.balance : debt.balance)) throw new Error("El pago supera el saldo de la obligación.");
  return {...state,debts:state.debts.map(item=>item.id === debt?.id || (cardId && item.linkedAccountId === cardId) ? {...item,balance:money(item.balance-direction*tx.amount)} : item),accounts:state.accounts.map(item=>item.id === cardId ? {...item,balance:money(item.balance+direction*tx.amount)} : item)};
}

export function financeReducer(state, action) {
  switch (action.type) {
    case "SAVE_MONTHLY_PLAN": {
      const plan=saveMonthlyPlan(state,action.payload);
      return {...state,monthlyPlans:[...(state.monthlyPlans || []).filter(item=>item.month !== plan.month),plan]};
    }
    case "SAVE_INITIAL_SAVINGS": {
      if(state.goals.some(goal=>goal.system==="standard_savings" && goal.initialSavingsConfirmed)) return state;
      const initialized=ensureStandardSavings(state);
      const goal=initialized.goals.find(row=>row.system === "standard_savings");
      let next=initialized;
      for(const row of action.payload.allocations || []) {
        const amount=money(row.amount);
        if(!Number.isFinite(Number(row.amount)) || amount<0) throw new Error("Indica montos de ahorro válidos.");
        if(amount>0) next=applySavingsOperation(next,{goalId:goal.id,accountId:row.accountId,amount,method:"protect"},uid);
      }
      return {...next,goals:next.goals.map(row=>row.id===goal.id ? {...row,initialSavingsConfirmed:true} : row),profile:{...next.profile,initialSavingsConfirmed:true},savingsContributions:next.savingsContributions.map(event=>initialized.savingsContributions.some(old=>old.id===event.id) ? event : {...event,method:"initial_protection"})};
    }
    case "ARCHIVE_GOAL": {
      const goal=state.goals.find(row=>row.id===action.payload);
      if(!goal || goal.system==="standard_savings") throw new Error("Ahorros permanece disponible.");
      if(state.savingsAllocations.some(row=>row.goalId===goal.id && row.amount>0)) throw new Error("Libera o reasigna el dinero apartado antes de archivar.");
      return {...state,goals:state.goals.map(row=>row.id===goal.id ? {...row,archived:true,monthlyContribution:0} : row),monthlyPlans:state.monthlyPlans.map(plan=>plan.month>=profileToday(state.profile).slice(0,7) ? {...plan,savings:plan.savings.map(row=>row.goalId===goal.id ? {...row,estimated:0,cancelled:true} : row)} : plan)};
    }
    case "SAVE_CATEGORY": return changeCategory(state,action.payload);
    case "SAVINGS_OPERATION": return action.payload.method === "reassign" ? reassignSavings(state,action.payload) : applySavingsOperation(state,action.payload,uid);
    case "LOAD_STATE":
      return action.payload;

    // Carga los datos de demostración. Se usa únicamente si el usuario lo
    // pide explícitamente desde Configuración; nunca al abrir la app.
    case "LOAD_DEMO_DATA": {
      const demo = migrateState(buildDemoState());
      const demoBackup = state.demoBackup || {
        accounts: state.accounts,
        transactions: state.transactions,
        goals: state.goals,
        debts: state.debts,
        recurringExpenses: state.recurringExpenses,
        recurringIncomes: state.recurringIncomes,
        savingsContributions: state.savingsContributions,
        emergencyFund: state.emergencyFund,
        financialSettings: state.financialSettings,
        sectionGuidesSeen: state.sectionGuidesSeen,
        categories: state.categories,
        paymentMethods: state.paymentMethods,
        processedRequestIds: state.processedRequestIds,
        currencyHistory: state.currencyHistory,
        monthlyPlans: state.monthlyPlans,
        savingsAllocations: state.savingsAllocations,
      };
      return {
        ...demo,
        profile: state.profile,
        demoBackup,
      };
    }

    case "RESTORE_USER_DATA":
      return state.demoBackup
        ? { ...state, ...state.demoBackup, demoBackup: null }
        : state;

    // Completa el onboarding: guarda el perfil ingresado y marca
    // onboardingCompleted en true. A partir de aquí la app entra directo.
    case "COMPLETE_ONBOARDING":
      return ensureStandardSavings({ ...state, profile: { ...state.profile, ...action.payload, onboardingCompleted: true } });

    // Edición posterior del perfil desde Configuración (no toca los datos
    // financieros, ni el flag de onboarding salvo que se lo pase explícito).
    case "UPDATE_PROFILE":
      return { ...state, profile: { ...state.profile, ...action.payload } };

    case "UPDATE_PROFILE_AND_CURRENCY":
      return {
        ...state,
        profile: { ...state.profile, ...action.payload.profile, currency: action.payload.currency },
        currencyHistory: [...(state.currencyHistory || []), {
          from: state.profile.currency,
          to: action.payload.currency,
          strategy: "without_conversion",
          changedAt: new Date().toISOString(),
        }],
      };

    case "CHANGE_CURRENCY_WITHOUT_CONVERSION":
      return {
        ...state,
        profile: { ...state.profile, currency: action.payload.currency },
        currencyHistory: [...(state.currencyHistory || []), {
          from: state.profile.currency,
          to: action.payload.currency,
          strategy: "without_conversion",
          changedAt: new Date().toISOString(),
        }],
      };

    case "UPDATE_FINANCIAL_SETTINGS":
      return { ...state, financialSettings: { ...state.financialSettings, ...action.payload } };

    case "SET_PROJECTION_SETTINGS":
      return {
        ...state,
        financialSettings: {
          ...state.financialSettings,
          projection: { ...state.financialSettings?.projection, ...action.payload },
        },
      };

    case "MARK_SECTION_GUIDE_SEEN":
      return {
        ...state,
        sectionGuidesSeen: { ...state.sectionGuidesSeen, [action.payload]: true },
      };

    // Borra los datos financieros (cuentas, movimientos, deudas, objetivos)
    // pero conserva el perfil ya configurado por el usuario.
    case "CLEAR_FINANCIAL_DATA":
      return {
        ...state,
        accounts: [],
        transactions: [],
        goals: [],
        debts: [],
        recurringExpenses: [],
        recurringIncomes: [],
        savingsContributions: [],
        emergencyFund: { current: 0, monthsTarget: 3, configured: false },
        financialSettings: buildEmptyState().financialSettings,
        demoBackup: null,
        monthlyPlans: [],
        savingsAllocations: [],
      };

    case "ADD_TRANSACTION": {
      if(action.payload.requestId && state.processedRequestIds.includes(action.payload.requestId)) return state;
      validateMovementDate(action.payload.date, state.profile);
      const amount = money(action.payload.amount);
      if (!Number.isFinite(amount) || amount <= 0) return state;
      if (!(state.accounts || []).some((account) => account.id === action.payload.accountId)) return state;
      const tx = { id: uid("tx"), origin: "user", generated: false, ...action.payload, amount, linkedAccountId: action.payload.accountId, categorySnapshot: categorySnapshot(state.categories.find(category=>category.id === action.payload.category)) };
      if(tx.linkedDebtId && !tx.linkedCreditCardId) tx.linkedCreditCardId=state.debts.find(debt=>debt.id === tx.linkedDebtId)?.linkedAccountId || null;
      const funded = applyExpenseFunding(state, tx);
      const accounts = (funded.accounts || []).map((a) => {
        if (a.id !== tx.accountId) return a;
        return { ...a, balance: money((Number(a.balance) || 0) + getTransactionBalanceDelta(tx)) };
      });
      return linkedPayment({ ...funded, transactions: [tx, ...(state.transactions || [])], accounts,processedRequestIds:tx.requestId ? [...state.processedRequestIds,tx.requestId] : state.processedRequestIds },tx,1);
    }

    case "ADD_TRANSACTION_WITH_RECURRENCE": {
      const transactionState = financeReducer(state, { type: "ADD_TRANSACTION", payload: action.payload.transaction });
      if (transactionState === state) return state;
      return financeReducer(transactionState, { type: "ADD_RECURRING_ITEM", payload: action.payload.recurrence });
    }

    case "TRANSFER_BETWEEN_ACCOUNTS": {
      if(action.payload.requestId && state.processedRequestIds.includes(action.payload.requestId)) return state;
      validateMovementDate(action.payload.date || profileToday(state.profile), state.profile);
      const source=state.accounts.find(account=>account.id === action.payload.fromAccountId);
      const protectedAmount=(state.savingsAllocations || []).filter(item=>item.accountId === source?.id).reduce((total,item)=>total+item.amount,0);
      if (!source || !(Number(action.payload.amount)>0) || Number(action.payload.amount) > money(source.balance-protectedAmount)) throw new Error("La cuenta no tiene suficiente dinero libre. Libera los aportes protegidos antes de transferirlos.");
      const transfer = buildTransfer({...action.payload,date:action.payload.date || profileToday(state.profile)}, state.accounts, uid, action.payload.createdAt || new Date());
      if (!transfer) throw new Error("Selecciona dos cuentas diferentes y un monto válido.");
      return {
        ...state,
        accounts: state.accounts.map((account) => account.id === transfer.source.id
          ? { ...account, balance: money(account.balance - transfer.amount) }
          : account.id === transfer.destination.id ? { ...account, balance: money(account.balance + transfer.amount) } : account),
        transactions: [transfer.incoming, transfer.outgoing, ...state.transactions],
        processedRequestIds:action.payload.requestId ? [...state.processedRequestIds,action.payload.requestId] : state.processedRequestIds,
      };
    }

    case "UPDATE_TRANSACTION": {
      const prev = state.transactions.find((t) => t.id === action.payload.id);
      if (!prev || prev.generated) return state;
      const next = { ...prev, ...action.payload, amount: money(action.payload.amount ?? prev.amount), linkedAccountId: action.payload.accountId ?? prev.accountId, categorySnapshot: prev.category === action.payload.category ? prev.categorySnapshot : categorySnapshot(state.categories.find(category=>category.id === action.payload.category)) };
      validateMovementDate(next.date, state.profile);
      // Remote rows contain balanceDelta. Recompute it when editing an
      // operating amount instead of reusing the previous persisted delta.
      if (["ingreso","gasto"].includes(next.type)) next.balanceDelta=next.type === "ingreso" ? next.amount : -next.amount;
      if (!(next.amount > 0) || !(state.accounts || []).some((account) => account.id === next.accountId)) return state;
      const restored=applyExpenseFunding(state,prev,-1);
      const reversed=linkedPayment(restored,prev,-1);
      const restoredAccounts=reversed.accounts.map(a=>a.id === prev.accountId ? {...a,balance:money(a.balance-getTransactionBalanceDelta(prev))} : a);
      const funded=applyExpenseFunding({...reversed,accounts:restoredAccounts},next);
      let accounts = funded.accounts;
      accounts = accounts.map((a) => {
        let balance = Number(a.balance) || 0;
        if (a.id === next.accountId) balance += getTransactionBalanceDelta(next);
        return { ...a, balance: money(balance) };
      });
      return linkedPayment({ ...funded,transactions:state.transactions.map(t=>t.id === next.id ? next : t),accounts },next,1);
    }

    case "DELETE_TRANSACTION": {
      const tx = state.transactions.find((t) => t.id === action.payload);
      if (!tx || tx.generated) return state;
      const restored=applyExpenseFunding(state,tx,-1);
      const accounts = restored.accounts.map((a) => {
        if (a.id !== tx.accountId) return a;
        return { ...a, balance: money(a.balance - getTransactionBalanceDelta(tx)) };
      });
      return linkedPayment({ ...restored, transactions: state.transactions.filter((t) => t.id !== action.payload), accounts },tx,-1);
    }

    case "CREATE_ACCOUNT":
    case "ADD_ACCOUNT": { // Alias conservado para llamadas de versiones anteriores.
      const requestId = action.payload.requestId;
      if (requestId && (state.processedRequestIds || []).includes(requestId)) return state;
      const { account, openingTransaction } = buildAccountCreation(action.payload, uid, action.payload.createdAt || new Date());
      if(openingTransaction) openingTransaction.date=profileToday(state.profile,new Date(action.payload.createdAt || Date.now()));
      if (!account.name || (state.accounts || []).some((item) => item.id === account.id)) return state;
      return ensureStandardSavings({
        ...state,
        accounts: [...state.accounts, account],
        transactions: openingTransaction ? [openingTransaction, ...state.transactions] : state.transactions,
        processedRequestIds: requestId ? [...(state.processedRequestIds || []).slice(-99), requestId] : state.processedRequestIds,
      });
    }

    case "UPDATE_ACCOUNT_AND_BALANCE": {
      const updated=financeReducer(state,{type:"UPDATE_ACCOUNT_METADATA",payload:action.payload});
      return financeReducer(updated,{type:"ADJUST_ACCOUNT_BALANCE",payload:action.payload});
    }
    case "UPDATE_ACCOUNT":
    case "UPDATE_ACCOUNT_METADATA":
      if(action.payload.type==="tarjeta_credito" && ((state.savingsAllocations || []).some(row=>row.accountId===action.payload.id && row.amount>0) || state.transactions.some(tx=>tx.accountId===action.payload.id && tx.savingsFunding?.amount>0))) throw new Error("Esta cuenta guarda o ha pagado ahorros. Conserva su historial y crea una tarjeta por separado.");
      return { ...state, accounts: state.accounts.map((a) => (a.id === action.payload.id ? { ...a, ...action.payload, balance: a.balance } : a)) };

    case "ADJUST_ACCOUNT_BALANCE": {
      const account = state.accounts.find((item) => item.id === action.payload.id);
      if (!account) return state;
      const requested = Math.max(0, money(action.payload.balance));
      const nextBalance = account.type === "tarjeta_credito" ? -requested : requested;
      if(account.type !== "tarjeta_credito" && nextBalance < reservedInAccount(state,account.id)) throw new Error("Libera o reasigna el dinero apartado antes de reducir el saldo.");
      const delta = money(nextBalance - (Number(account.balance) || 0));
      if (delta === 0) return state;
      const adjustment = {
        id: uid("tx"),
        type: "ajuste",
        description: `Ajuste de saldo — ${account.name}`,
        amount: Math.abs(delta),
        balanceDelta: delta,
        date: localDateString(),
        category: "ajuste_saldo",
        accountId: account.id,
        linkedAccountId: account.id,
        origin: "balance_adjustment",
        generated: true,
        createdAt: new Date().toISOString(),
      };
      return {
        ...state,
        accounts: state.accounts.map((item) => item.id === account.id ? { ...item, balance: nextBalance } : item),
        transactions: [adjustment, ...state.transactions],
      };
    }

    case "DELETE_ACCOUNT": {
      if ((state.savingsAllocations || []).some(item=>item.accountId === action.payload && item.amount > 0)) return state;
      const linked = state.transactions.filter((transaction) => transaction.accountId === action.payload);
      if (linked.some((transaction) => !transaction.generated)) return state;
      return {
        ...state,
        accounts: state.accounts.filter((a) => a.id !== action.payload),
        transactions: state.transactions.filter((transaction) => transaction.accountId !== action.payload),
      };
    }

    case "ADD_RECURRING_ITEM": {
      const collection = action.payload.kind === "ingreso" ? "recurringIncomes" : "recurringExpenses";
      const item = { id: uid("rec"), frequency: "mensual", active: true, ...action.payload };
      delete item.kind;
      return { ...state, [collection]: [...(state[collection] || []), item] };
    }

    case "UPDATE_RECURRING_ITEM": {
      const collection = action.payload.kind === "ingreso" ? "recurringIncomes" : "recurringExpenses";
      const { kind, ...changes } = action.payload;
      return { ...state, [collection]: (state[collection] || []).map((item) => item.id === action.payload.id ? { ...item, ...changes } : item) };
    }

    case "DELETE_RECURRING_ITEM": {
      const collection = action.payload.kind === "ingreso" ? "recurringIncomes" : "recurringExpenses";
      return { ...state, [collection]: (state[collection] || []).filter((item) => item.id !== action.payload.id) };
    }

    case "ADD_GOAL": {
      if (!action.payload.name?.trim() || !(Number(action.payload.target)>0) || !Number.isFinite(Number(action.payload.target)) || !Number.isFinite(Number(action.payload.monthlyContribution || 0)) || Number(action.payload.monthlyContribution || 0)<0 || !["mensual","semanal"].includes(action.payload.contributionFrequency || "mensual")) throw new Error("Revisa el nombre, los montos y la frecuencia del plan.");
      return { ...state, goals: [...state.goals, { id: uid("goal"), contributionFrequency:"mensual", ...action.payload, current: 0 }] };
    }

    case "UPDATE_GOAL": {
      const previous=state.goals.find(goal=>goal.id === action.payload.id);
      if(!previous) return state;
      if(previous.system === "standard_savings") throw new Error("Ahorros conserva el dinero existente; crea otro plan para un objetivo específico.");
      const next={...previous,...action.payload,current:previous.current};
      if(!next.name?.trim() || !(Number(next.target)>0) || !Number.isFinite(Number(next.target)) || Number(next.target)<money(Number(previous.current)+goalUsed(state,previous.id)) || !Number.isFinite(Number(next.monthlyContribution || 0)) || Number(next.monthlyContribution || 0)<0 || !["mensual","semanal"].includes(next.contributionFrequency || "mensual")) throw new Error("Revisa el nombre, los montos y la frecuencia. El objetivo no puede ser menor al dinero ya asignado.");
      return {...state,goals:state.goals.map(goal=>goal.id === next.id ? next : goal)};
    }

    case "DELETE_GOAL": {
      if(state.transactions.some(tx=>tx.savingsFunding?.goalId===action.payload)) throw new Error("Este plan tiene gastos vinculados. Archívalo para conservar el historial.");
      if(state.goals.find(goal=>goal.id === action.payload)?.system === "standard_savings") throw new Error("Ahorros es el plan general de tus ahorros existentes y no se elimina.");
      if ((state.savingsAllocations || []).some(item=>item.goalId === action.payload && item.amount > 0)) throw new Error("Libera primero los aportes vinculados al plan.");
      if ((state.monthlyPlans || []).some(plan=>plan.month >= localDateString().slice(0,7) && plan.savings.some(item=>item.goalId === action.payload && item.estimated>0))) throw new Error("Quita primero sus aportes previstos en Mi mes para no dejar compromisos sin plan.");
      return {...state,goals:state.goals.filter(goal=>goal.id !== action.payload)};
    }

    case "ADD_TO_GOAL": {
      return applySavingsOperation(state,{...action.payload,goalId:action.payload.id,method:action.payload.method || "protect"},uid);
    }

    case "ADD_DEBT":
      return { ...state, debts: [...state.debts, { id: uid("debt"), ...action.payload }] };

    case "UPDATE_DEBT":
      return { ...state, debts: state.debts.map((d) => (d.id === action.payload.id ? { ...d, ...action.payload } : d)) };

    case "DELETE_DEBT":
      return { ...state, debts: state.debts.filter((d) => d.id !== action.payload) };

    case "PAY_DEBT": {
      const debt = state.debts.find((d) => d.id === action.payload.id);
      const amount = Number(action.payload.amount);
      const account = state.accounts.find((a) => a.id === action.payload.accountId && a.type !== "tarjeta_credito");
      if (!debt || !account || !Number.isFinite(amount) || amount <= 0) return state;
      const payment = Math.min(
        amount,
        Math.max(0, Number(debt.balance) || 0),
        Math.max(0, money(Number(account.balance)-reservedInAccount(state,account.id)))
      );
      if (payment <= 0) return state;
      const date = new Date();
      const dateValue =
        date.getFullYear() +
        "-" +
        String(date.getMonth() + 1).padStart(2, "0") +
        "-" +
        String(date.getDate()).padStart(2, "0");
      return {
        ...state,
        debts: state.debts.map((d) => (d.id === debt.id ? { ...d, balance: money(d.balance - payment) } : d)),
        accounts: state.accounts.map((a) => {
          if (a.id === account.id) return { ...a, balance: money(a.balance - payment) };
          if (a.id === debt.linkedAccountId && a.type === "tarjeta_credito") return { ...a, balance: Math.min(0, money(a.balance + payment)) };
          return a;
        }),
        transactions: [
          {
            id: uid("tx"),
            description: "Pago de " + debt.name,
            amount: payment,
            date: dateValue,
            category: "deudas",
            accountId: account.id,
            paymentMethod: "transferencia",
            type: "gasto",
            origin: "debt_payment",
            generated: true,
            linkedDebtId: debt.id,
            linkedCreditCardId: debt.linkedAccountId || null,
          },
          ...state.transactions,
        ],
      };
    }

    case "SET_EMERGENCY_FUND":
      return { ...state, emergencyFund: { ...state.emergencyFund, ...action.payload } };

    case "ADD_TO_EMERGENCY_FUND": {
      return applySavingsOperation(state,{...action.payload,method:action.payload.method || "protect"},uid);
    }

    default:
      return state;
  }
}
