import React, { createContext, useContext, useEffect, useReducer } from "react";
import { buildEmptyState, buildDemoState } from "../data/mockData.js";
import { loadState, saveState } from "../services/storage.js";

const STORAGE_KEY = "estado-financiero-v1";
const FinanceStateContext = createContext(null);
const FinanceDispatchContext = createContext(null);

function normalizeState(savedState) {
  const empty = buildEmptyState();
  if (!savedState) return empty;
  return {
    ...empty,
    ...savedState,
    profile: { ...empty.profile, ...(savedState.profile || {}) },
    emergencyFund: { ...empty.emergencyFund, ...(savedState.emergencyFund || {}) },
    financialSettings: {
      ...empty.financialSettings,
      ...(savedState.financialSettings || {}),
      projection: {
        ...empty.financialSettings.projection,
        ...(savedState.financialSettings?.projection || {}),
      },
    },
    sectionGuidesSeen: savedState.sectionGuidesSeen || {},
  };
}

function uid(prefix) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

function reducer(state, action) {
  switch (action.type) {
    case "LOAD_STATE":
      return action.payload;

    // Carga los datos de demostración. Se usa únicamente si el usuario lo
    // pide explícitamente desde Configuración; nunca al abrir la app.
    case "LOAD_DEMO_DATA": {
      const demo = buildDemoState();
      const demoBackup = state.demoBackup || {
        accounts: state.accounts,
        transactions: state.transactions,
        goals: state.goals,
        debts: state.debts,
        recurringExpenses: state.recurringExpenses,
        emergencyFund: state.emergencyFund,
        financialSettings: state.financialSettings,
        sectionGuidesSeen: state.sectionGuidesSeen,
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
      return { ...state, profile: { ...state.profile, ...action.payload, onboardingCompleted: true } };

    // Edición posterior del perfil desde Configuración (no toca los datos
    // financieros, ni el flag de onboarding salvo que se lo pase explícito).
    case "UPDATE_PROFILE":
      return { ...state, profile: { ...state.profile, ...action.payload } };

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
        emergencyFund: { current: 0, monthsTarget: 3, configured: false },
        financialSettings: buildEmptyState().financialSettings,
        demoBackup: null,
      };

    case "ADD_TRANSACTION": {
      const amount = Number(action.payload.amount);
      if (!Number.isFinite(amount) || amount <= 0) return state;
      if (!(state.accounts || []).some((account) => account.id === action.payload.accountId)) return state;
      const tx = { id: uid("tx"), ...action.payload, amount };
      const accounts = (state.accounts || []).map((a) => {
        if (a.id !== tx.accountId) return a;
        const delta = tx.type === "ingreso" ? tx.amount : -tx.amount;
        return { ...a, balance: (Number(a.balance) || 0) + delta };
      });
      return { ...state, transactions: [tx, ...(state.transactions || [])], accounts };
    }

    case "UPDATE_TRANSACTION": {
      const prev = state.transactions.find((t) => t.id === action.payload.id);
      const next = { ...prev, ...action.payload };
      let accounts = state.accounts;
      if (prev) {
        accounts = accounts.map((a) => {
          let balance = a.balance;
          if (a.id === prev.accountId) balance -= prev.type === "ingreso" ? prev.amount : -prev.amount;
          if (a.id === next.accountId) balance += next.type === "ingreso" ? next.amount : -next.amount;
          return { ...a, balance };
        });
      }
      return {
        ...state,
        transactions: state.transactions.map((t) => (t.id === next.id ? next : t)),
        accounts,
      };
    }

    case "DELETE_TRANSACTION": {
      const tx = state.transactions.find((t) => t.id === action.payload);
      const accounts = state.accounts.map((a) => {
        if (!tx || a.id !== tx.accountId) return a;
        const delta = tx.type === "ingreso" ? -tx.amount : tx.amount;
        return { ...a, balance: a.balance + delta };
      });
      return { ...state, transactions: state.transactions.filter((t) => t.id !== action.payload), accounts };
    }

    case "ADD_ACCOUNT":
      return { ...state, accounts: [...state.accounts, { id: uid("acc"), ...action.payload }] };

    case "UPDATE_ACCOUNT":
      return { ...state, accounts: state.accounts.map((a) => (a.id === action.payload.id ? { ...a, ...action.payload } : a)) };

    case "DELETE_ACCOUNT":
      return { ...state, accounts: state.accounts.filter((a) => a.id !== action.payload) };

    case "ADD_GOAL":
      return { ...state, goals: [...state.goals, { id: uid("goal"), current: 0, ...action.payload }] };

    case "UPDATE_GOAL":
      return { ...state, goals: state.goals.map((g) => (g.id === action.payload.id ? { ...g, ...action.payload } : g)) };

    case "DELETE_GOAL":
      return { ...state, goals: state.goals.filter((g) => g.id !== action.payload) };

    case "ADD_TO_GOAL":
      return {
        ...state,
        goals: state.goals.map((g) => {
          if (g.id !== action.payload.id) return g;
          const amount = Number(action.payload.amount);
          if (!Number.isFinite(amount) || amount <= 0) return g;
          const target = Math.max(0, Number(g.target) || 0);
          const current = Math.max(0, Number(g.current) || 0);
          return { ...g, current: Math.min(target, current + amount) };
        }),
      };

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
        Math.max(0, Number(account.balance) || 0)
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
        debts: state.debts.map((d) => (d.id === debt.id ? { ...d, balance: d.balance - payment } : d)),
        accounts: state.accounts.map((a) => (a.id === account.id ? { ...a, balance: a.balance - payment } : a)),
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
          },
          ...state.transactions,
        ],
      };
    }

    case "SET_EMERGENCY_FUND":
      return { ...state, emergencyFund: { ...state.emergencyFund, ...action.payload } };

    case "ADD_TO_EMERGENCY_FUND": {
      const amount = Number(action.payload.amount);
      if (!Number.isFinite(amount) || amount <= 0) return state;
      return {
        ...state,
        emergencyFund: {
          ...(state.emergencyFund || { monthsTarget: 3 }),
          current: Math.max(0, Number(state.emergencyFund?.current) || 0) + amount,
        },
      };
    }

    default:
      return state;
  }
}

export function FinanceProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, null, () => normalizeState(loadState(STORAGE_KEY)));

  useEffect(() => {
    saveState(STORAGE_KEY, state);
  }, [state]);

  return (
    <FinanceStateContext.Provider value={state}>
      <FinanceDispatchContext.Provider value={dispatch}>{children}</FinanceDispatchContext.Provider>
    </FinanceStateContext.Provider>
  );
}

export function useFinanceState() {
  const ctx = useContext(FinanceStateContext);
  if (!ctx) throw new Error("useFinanceState debe usarse dentro de <FinanceProvider>");
  return ctx;
}

export function useFinanceDispatch() {
  const ctx = useContext(FinanceDispatchContext);
  if (!ctx) throw new Error("useFinanceDispatch debe usarse dentro de <FinanceProvider>");
  return ctx;
}
