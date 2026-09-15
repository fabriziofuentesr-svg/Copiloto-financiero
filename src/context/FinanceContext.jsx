import React, { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { buildEmptyState, buildDemoState } from "../data/mockData.js";
import { migrateState } from "../services/migrations.js";
import { buildAccountCreation, buildTransfer, getTransactionBalanceDelta } from "../services/financial/ledger.js";
import { localDateString } from "../services/financial/format.js";
import { useAuth } from "../auth/AuthContext.jsx";
import { createFinanceRepository } from "../repositories/factory.js";
import { DATA_STATUS } from "../repositories/contracts.js";
import { createLocalBackup, fingerprintState, inspectLocalMigration, migrationId, removeMigratedLocalData } from "../services/import/localMigration.js";
import { GUEST_STATE_KEY } from "../repositories/localFinanceRepository.js";
import { clearState } from "../services/storage.js";

const FinanceStateContext = createContext(null);
const FinanceDispatchContext = createContext(null);
const FinanceMetaContext = createContext(null);

function uid(prefix) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

function money(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

export function financeReducer(state, action) {
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
        recurringIncomes: state.recurringIncomes,
        savingsContributions: state.savingsContributions,
        emergencyFund: state.emergencyFund,
        financialSettings: state.financialSettings,
        sectionGuidesSeen: state.sectionGuidesSeen,
        categories: state.categories,
        paymentMethods: state.paymentMethods,
        processedRequestIds: state.processedRequestIds,
        currencyHistory: state.currencyHistory,
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
      };

    case "ADD_TRANSACTION": {
      const amount = money(action.payload.amount);
      if (!Number.isFinite(amount) || amount <= 0) return state;
      if (!(state.accounts || []).some((account) => account.id === action.payload.accountId)) return state;
      const tx = { id: uid("tx"), origin: "user", generated: false, ...action.payload, amount, linkedAccountId: action.payload.accountId };
      const accounts = (state.accounts || []).map((a) => {
        if (a.id !== tx.accountId) return a;
        return { ...a, balance: money((Number(a.balance) || 0) + getTransactionBalanceDelta(tx)) };
      });
      return { ...state, transactions: [tx, ...(state.transactions || [])], accounts };
    }

    case "ADD_TRANSACTION_WITH_RECURRENCE": {
      const transactionState = financeReducer(state, { type: "ADD_TRANSACTION", payload: action.payload.transaction });
      if (transactionState === state) return state;
      return financeReducer(transactionState, { type: "ADD_RECURRING_ITEM", payload: action.payload.recurrence });
    }

    case "TRANSFER_BETWEEN_ACCOUNTS": {
      const transfer = buildTransfer(action.payload, state.accounts, uid, action.payload.createdAt || new Date());
      if (!transfer) return state;
      return {
        ...state,
        accounts: state.accounts.map((account) => account.id === transfer.source.id
          ? { ...account, balance: money(account.balance - transfer.amount) }
          : account.id === transfer.destination.id ? { ...account, balance: money(account.balance + transfer.amount) } : account),
        transactions: [transfer.incoming, transfer.outgoing, ...state.transactions],
      };
    }

    case "UPDATE_TRANSACTION": {
      const prev = state.transactions.find((t) => t.id === action.payload.id);
      if (!prev || prev.generated) return state;
      const next = { ...prev, ...action.payload, amount: money(action.payload.amount ?? prev.amount), linkedAccountId: action.payload.accountId ?? prev.accountId };
      if (!(next.amount > 0) || !(state.accounts || []).some((account) => account.id === next.accountId)) return state;
      let accounts = state.accounts;
      accounts = accounts.map((a) => {
        let balance = Number(a.balance) || 0;
        if (a.id === prev.accountId) balance -= getTransactionBalanceDelta(prev);
        if (a.id === next.accountId) balance += getTransactionBalanceDelta(next);
        return { ...a, balance: money(balance) };
      });
      return {
        ...state,
        transactions: state.transactions.map((t) => (t.id === next.id ? next : t)),
        accounts,
      };
    }

    case "DELETE_TRANSACTION": {
      const tx = state.transactions.find((t) => t.id === action.payload);
      if (!tx || tx.generated) return state;
      const accounts = state.accounts.map((a) => {
        if (a.id !== tx.accountId) return a;
        return { ...a, balance: money(a.balance - getTransactionBalanceDelta(tx)) };
      });
      return { ...state, transactions: state.transactions.filter((t) => t.id !== action.payload), accounts };
    }

    case "CREATE_ACCOUNT":
    case "ADD_ACCOUNT": { // Alias conservado para llamadas de versiones anteriores.
      const requestId = action.payload.requestId;
      if (requestId && (state.processedRequestIds || []).includes(requestId)) return state;
      const { account, openingTransaction } = buildAccountCreation(action.payload, uid, action.payload.createdAt || new Date());
      if (!account.name || (state.accounts || []).some((item) => item.id === account.id)) return state;
      return {
        ...state,
        accounts: [...state.accounts, account],
        transactions: openingTransaction ? [openingTransaction, ...state.transactions] : state.transactions,
        processedRequestIds: requestId ? [...(state.processedRequestIds || []).slice(-99), requestId] : state.processedRequestIds,
      };
    }

    case "UPDATE_ACCOUNT":
    case "UPDATE_ACCOUNT_METADATA":
      return { ...state, accounts: state.accounts.map((a) => (a.id === action.payload.id ? { ...a, ...action.payload, balance: a.balance } : a)) };

    case "ADJUST_ACCOUNT_BALANCE": {
      const account = state.accounts.find((item) => item.id === action.payload.id);
      if (!account) return state;
      const requested = Math.max(0, money(action.payload.balance));
      const nextBalance = account.type === "tarjeta_credito" ? -requested : requested;
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

    case "ADD_GOAL":
      return { ...state, goals: [...state.goals, { id: uid("goal"), current: 0, ...action.payload }] };

    case "UPDATE_GOAL":
      return { ...state, goals: state.goals.map((g) => (g.id === action.payload.id ? { ...g, ...action.payload } : g)) };

    case "DELETE_GOAL":
      return { ...state, goals: state.goals.filter((g) => g.id !== action.payload) };

    case "ADD_TO_GOAL": {
      const amount = money(action.payload.amount);
      if (!(amount > 0) || !state.goals.some((goal) => goal.id === action.payload.id)) return state;
      return {
        ...state,
        goals: state.goals.map((g) => {
          if (g.id !== action.payload.id) return g;
          const target = Math.max(0, Number(g.target) || 0);
          const current = Math.max(0, Number(g.current) || 0);
          return { ...g, current: money(Math.min(target, current + amount)) };
        }),
        savingsContributions: [...(state.savingsContributions || []), { id: uid("saving"), kind: "goal", linkedGoalId: action.payload.id, amount, date: localDateString(), origin: "user" }],
      };
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
        savingsContributions: [...(state.savingsContributions || []), { id: uid("saving"), kind: "emergency", amount: money(amount), date: localDateString(), origin: "user" }],
      };
    }

    default:
      return state;
  }
}

export function FinanceProvider({ children }) {
  const auth = useAuth();
  const [state, baseDispatch] = useReducer(financeReducer, null, buildEmptyState);
  const stateRef = useRef(state);
  const repositoryRef = useRef(null);
  const repositoryGenerationRef = useRef(0);
  const mutationQueueRef = useRef(Promise.resolve());
  const savedTimerRef = useRef(null);
  const [status, setStatus] = useState(DATA_STATUS.LOADING);
  const [message, setMessage] = useState("");
  const [migration, setMigration] = useState({ status: "idle", available: false, state: null, summary: null });
  stateRef.current = state;

  useEffect(() => {
    let active = true;
    repositoryGenerationRef.current += 1;
    const repository = createFinanceRepository(auth);
    repositoryRef.current = repository;
    if (!repository) {
      const empty = buildEmptyState();
      stateRef.current = empty;
      baseDispatch({ type: "LOAD_STATE", payload: empty });
      setMigration({ status: "idle", available: false, state: null, summary: null });
      setStatus(DATA_STATUS.IDLE);
      return undefined;
    }
    setStatus(DATA_STATUS.LOADING);
    repository.load().then((loaded) => {
      if (!active) return;
      const normalized = migrateState(loaded);
      stateRef.current = normalized;
      baseDispatch({ type: "LOAD_STATE", payload: normalized });
      setStatus(DATA_STATUS.IDLE);
      if (repository.mode === "supabase") {
        const local = inspectLocalMigration();
        Promise.all([
          repository.hasRemoteData(),
          local.available && local.state ? fingerprintState(local.state).then((fingerprint) => repository.getImportStatus(fingerprint)) : null,
        ]).then(([remoteExists, previousImport]) => {
          if (!active) return;
          const alreadyImported = previousImport?.status === "completed";
          setMigration((current) => ({
            ...current,
            ...local,
            remoteExists: remoteExists && !alreadyImported,
            previousImport,
            status: !local.available ? "idle" : alreadyImported ? "completed" : "pending",
          }));
        }).catch(() => {
          if (active) setMigration((current) => ({ ...current, ...local, remoteExists: true, status: local.available ? "pending" : "idle", error: "No pudimos comparar los datos locales y remotos." }));
        });
      }
    }).catch((error) => {
      if (!active) return;
      setMessage(error.userMessage || "No pudimos cargar tu información.");
      setStatus(error.code === "session_expired" ? DATA_STATUS.SESSION_EXPIRED : DATA_STATUS.ERROR);
    });
    return () => {
      active = false;
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    };
  }, [auth.status, auth.user?.id]);

  const dispatch = useCallback((action) => {
    const mutation = async () => {
      const repository = repositoryRef.current;
      if (!repository) return;
      const repositoryGeneration = repositoryGenerationRef.current;
      const previousState = stateRef.current;
      const nextState = financeReducer(previousState, action);
      if (nextState === previousState) return;
      stateRef.current = nextState;
      baseDispatch({ type: "LOAD_STATE", payload: nextState });
      setStatus(DATA_STATUS.SAVING);
      setMessage("");
      try {
        const saved = await repository.apply({ action, previousState, nextState });
        if (repositoryGeneration !== repositoryGenerationRef.current) return;
        const normalized = saved ? migrateState(saved) : nextState;
        stateRef.current = normalized;
        baseDispatch({ type: "LOAD_STATE", payload: normalized });
        setStatus(DATA_STATUS.SAVED);
        if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
        savedTimerRef.current = setTimeout(() => setStatus((current) => current === DATA_STATUS.SAVED ? DATA_STATUS.IDLE : current), 1200);
      } catch (error) {
        if (repositoryGeneration !== repositoryGenerationRef.current) return;
        stateRef.current = previousState;
        baseDispatch({ type: "LOAD_STATE", payload: previousState });
        setMessage(error.userMessage || "No pudimos guardar los cambios.");
        setStatus(error.code === "session_expired" ? DATA_STATUS.SESSION_EXPIRED : DATA_STATUS.ERROR);
      }
    };
    mutationQueueRef.current = mutationQueueRef.current.then(mutation, mutation);
    return mutationQueueRef.current;
  }, []);

  const importLocal = useCallback(async () => {
    const repository = repositoryRef.current;
    if (!repository || !migration.state) return;
    const repositoryGeneration = repositoryGenerationRef.current;
    setMigration((current) => ({ ...current, status: "running", error: "" }));
    try {
      const fingerprint = await fingerprintState(migration.state);
      const id = migrationId(fingerprint);
      const backupKey = createLocalBackup(migration.state, id);
      const result = await repository.importLocal(migration.state, id, fingerprint);
      if (repositoryGeneration !== repositoryGenerationRef.current) return;
      if (!result.verification?.ok) throw new Error("La importación remota terminó, pero la conciliación no coincide. Conservamos la copia local para revisarla.");
      stateRef.current = result.state;
      baseDispatch({ type: "LOAD_STATE", payload: result.state });
      setMigration((current) => ({ ...current, status: "completed", result, backupKey }));
    } catch (error) {
      if (repositoryGeneration !== repositoryGenerationRef.current) return;
      setMigration((current) => ({ ...current, status: "failed", error: error.userMessage || "No pudimos completar la importación." }));
    }
  }, [migration.state]);

  const meta = useMemo(() => ({
    status, message, migration, repositoryMode: repositoryRef.current?.mode || null,
    importLocal,
    dismissMigration: () => setMigration((current) => ({ ...current, status: "dismissed" })),
    removeLocalCopy: () => { removeMigratedLocalData(migration.backupKey, migration.sourceKey); setMigration((current) => ({ ...current, status: "dismissed", available: false })); },
    clearGuestData: () => {
      clearState(GUEST_STATE_KEY);
      const empty = buildEmptyState();
      stateRef.current = empty;
      baseDispatch({ type: "LOAD_STATE", payload: empty });
    },
    clearMessage: () => setMessage(""),
  }), [status, message, migration, importLocal]);

  return (
    <FinanceStateContext.Provider value={state}>
      <FinanceDispatchContext.Provider value={dispatch}>
        <FinanceMetaContext.Provider value={meta}>{children}</FinanceMetaContext.Provider>
      </FinanceDispatchContext.Provider>
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

export function useFinanceMeta() {
  const ctx = useContext(FinanceMetaContext);
  if (!ctx) throw new Error("useFinanceMeta debe usarse dentro de FinanceProvider");
  return ctx;
}
