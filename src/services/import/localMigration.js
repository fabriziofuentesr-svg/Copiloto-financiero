import { migrateState } from "../migrations.js";
import { GUEST_STATE_KEY, LOCAL_STATE_KEY } from "../../repositories/localFinanceRepository.js";
import { clearState, saveState } from "../storage.js";

export function hasUserFinancialData(state) {
  return Boolean(state && ((state.accounts?.length || 0) + (state.transactions?.length || 0) + (state.goals?.length || 0) + (state.debts?.length || 0) > 0 || state.profile?.onboardingCompleted));
}

export function inspectLocalMigration() {
  let raw;
  let sourceKey = GUEST_STATE_KEY;
  try {
    let serialized = globalThis.localStorage?.getItem(`copiloto-financiero:${GUEST_STATE_KEY}`);
    if (serialized === null || serialized === undefined) {
      sourceKey = LOCAL_STATE_KEY;
      serialized = globalThis.localStorage?.getItem(`copiloto-financiero:${LOCAL_STATE_KEY}`);
    }
    if (serialized === null || serialized === undefined) return { available: false, state: null, summary: null };
    raw = JSON.parse(serialized);
  } catch {
    return { available: true, invalid: true, state: null, summary: null };
  }
  if (!raw || !hasUserFinancialData(raw) || raw.demoBackup) return { available: false, state: null, summary: null };
  try {
    const state = migrateState(raw);
    return {
      available: true,
      sourceKey,
      state,
      summary: {
        accounts: state.accounts.length,
        transactions: state.transactions.length,
        goals: state.goals.length,
        debts: state.debts.length,
        recurring: state.recurringExpenses.length + state.recurringIncomes.length,
        settings: 1,
      },
    };
  } catch {
    return { available: true, invalid: true, state: null, summary: null };
  }
}

function cents(value) { return Math.round((Number(value) || 0) * 100); }
function canonical(value) { return JSON.stringify(value,(_,item)=>item && typeof item === "object" && !Array.isArray(item) ? Object.fromEntries(Object.keys(item).sort().map(key=>[key,item[key]])) : item); }

export function compareFinanceStates(localState, remoteState) {
  const local = migrateState(localState);
  const remote = migrateState(remoteState);
  const remoteAccounts = new Map(remote.accounts.map((account) => [account.id, account]));
  const balancesMatch = local.accounts.every((account) => remoteAccounts.has(account.id) && cents(remoteAccounts.get(account.id).balance) === cents(account.balance));
  const relationsValid = remote.transactions.every((transaction) => !transaction.accountId || remoteAccounts.has(transaction.accountId));
  const checks = {
    accounts: remote.accounts.length === local.accounts.length,
    transactions: remote.transactions.length >= local.transactions.length,
    goals: remote.goals.length === local.goals.length,
    debts: remote.debts.length === local.debts.length,
    recurring: remote.recurringExpenses.length + remote.recurringIncomes.length === local.recurringExpenses.length + local.recurringIncomes.length,
    balances: balancesMatch,
    relations: relationsValid,
    planning: canonical(local.monthlyPlans) === canonical(remote.monthlyPlans),
    allocations: canonical(local.savingsAllocations) === canonical(remote.savingsAllocations),
    categoryHistory: local.transactions.every(tx=>canonical(tx.categorySnapshot) === canonical(remote.transactions.find(item=>item.id === tx.id)?.categorySnapshot)),
    savingsRelations: local.savingsContributions.every(event=>{const saved=remote.savingsContributions.find(item=>item.id === event.id);return saved && saved.method === event.method && saved.accountId === event.accountId;}),
  };
  return {
    ok: Object.values(checks).every(Boolean),
    checks,
    local: {
      accounts: local.accounts.length,
      transactions: local.transactions.length,
      goals: local.goals.length,
      debts: local.debts.length,
    },
    remote: {
      accounts: remote.accounts.length,
      transactions: remote.transactions.length,
      goals: remote.goals.length,
      debts: remote.debts.length,
    },
  };
}

export async function fingerprintState(state) {
  const bytes = new TextEncoder().encode(JSON.stringify(state));
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(hash)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

export function migrationId(fingerprint) { return `browser-v2-${fingerprint.slice(0, 24)}`; }

export function createLocalBackup(state, id) {
  const key = `migration-backup-${id}`;
  if (!saveState(key, { createdAt: new Date().toISOString(), state })) throw new Error("No se pudo crear la copia de seguridad local.");
  return key;
}

export function removeMigratedLocalData(backupKey, sourceKey = GUEST_STATE_KEY) {
  clearState(sourceKey);
  if (backupKey) clearState(backupKey);
}
