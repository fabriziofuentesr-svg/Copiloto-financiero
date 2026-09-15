import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { safeReturnPath, authUiState } from "../src/auth/authState.js";
import { assertFinanceRepository } from "../src/repositories/contracts.js";
import { createLocalFinanceRepository } from "../src/repositories/localFinanceRepository.js";
import { createSupabaseFinanceRepository } from "../src/repositories/supabaseFinanceRepository.js";
import { buildEmptyState } from "../src/data/mockData.js";
import { compareFinanceStates, inspectLocalMigration } from "../src/services/import/localMigration.js";

function memoryStorage() {
  const values = new Map();
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) };
}

test("las redirecciones de OAuth solo aceptan rutas internas", () => {
  assert.equal(safeReturnPath("/movimientos?nuevo=ingreso"), "/movimientos?nuevo=ingreso");
  assert.equal(safeReturnPath("//malicioso.example"), "/");
  assert.equal(safeReturnPath("https://malicioso.example"), "/");
  assert.equal(safeReturnPath("%2F%2Fmalicioso.example"), "/");
});

test("los estados de autenticación no muestran datos mientras carga o falla", () => {
  assert.equal(authUiState({ loading: true, user: { id: "a" } }), "loading");
  assert.equal(authUiState({ loading: false, user: null }), "anonymous");
  assert.equal(authUiState({ loading: false, user: { id: "a" } }), "authenticated");
  assert.equal(authUiState({ loading: false, user: null, error: "expired" }), "error");
});

test("el adaptador local conserva el contrato y los datos anteriores", async () => {
  globalThis.localStorage = memoryStorage();
  const repository = assertFinanceRepository(createLocalFinanceRepository());
  const state = buildEmptyState();
  state.profile.name = "Ana";
  await repository.apply({ nextState: state });
  assert.equal((await repository.load()).profile.name, "Ana");
});

test("el repositorio remoto usa RPC autenticadas y conserva revisión", async () => {
  const calls = [];
  const state = buildEmptyState();
  const client = { rpc: async (name, args) => {
    calls.push({ name, args });
    if (name === "get_finance_state") return { data: { revision: 4, state }, error: null };
    if (name === "apply_finance_state") return { data: { revision: 5, state: args.p_state }, error: null };
    if (name === "has_finance_data") return { data: false, error: null };
    if (name === "get_local_import_status") return { data: { status: "completed" }, error: null };
    return { data: { revision: 6, state }, error: null };
  } };
  const repository = createSupabaseFinanceRepository(client, "user-a");
  await repository.load();
  await repository.apply({ action: { type: "UPDATE_PROFILE", meta: { operationId: "op-1" } }, nextState: state });
  assert.deepEqual(calls[1], { name: "apply_finance_state", args: { p_state: state, p_expected_revision: 4, p_operation_id: "op-1" } });
  assert.deepEqual(await repository.getImportStatus("hash-1"), { status: "completed" });
});

test("la conciliación de migración compara cantidades, relaciones y saldos en centavos", () => {
  const local = buildEmptyState();
  local.accounts = [{ id: "cash", name: "Caja", type: "efectivo", balance: 10.25 }];
  local.transactions = [{ id: "opening", type: "ingreso", amount: 10.25, balanceDelta: 10.25, accountId: "cash", date: "2026-09-15", origin: "initial_balance" }];
  const equal = compareFinanceStates(local, structuredClone(local));
  assert.equal(equal.ok, true);
  const changed = structuredClone(local);
  changed.accounts[0].balance = 10.24;
  assert.equal(compareFinanceStates(local, changed).checks.balances, false);
});

test("los datos locales dañados se detectan sin borrarlos", () => {
  globalThis.localStorage = memoryStorage();
  globalThis.localStorage.setItem("copiloto-financiero:estado-financiero-v1", "{no-es-json");
  assert.deepEqual(inspectLocalMigration(), { available: true, invalid: true, state: null, summary: null });
  assert.equal(globalThis.localStorage.getItem("copiloto-financiero:estado-financiero-v1"), "{no-es-json");
});

test("la migración SQL exige RLS, relaciones por usuario e idempotencia", async () => {
  const sql = await readFile(new URL("../supabase/migrations/202609150001_finance_auth_schema.sql", import.meta.url), "utf8");
  for (const table of ["profiles", "accounts", "transactions", "transaction_entries", "goals", "debts", "local_import_batches"]) assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`, "i"));
  assert.match(sql, /auth\.uid\(\)\) = user_id/);
  assert.match(sql, /transactions_initial_balance_uidx/);
  assert.match(sql, /foreign key \(account_id,user_id\)/);
  assert.match(sql, /get_local_import_status/);
  assert.match(sql, /has_finance_data\(\).*onboarding_completed/is);
  assert.match(sql, /case when a->>'minimumPayment' is null then null/is);
  assert.doesNotMatch(sql, /service_role/);
});

test("las rutas privadas, login y callback están instalados", async () => {
  const app = await readFile(new URL("../src/App.jsx", import.meta.url), "utf8");
  assert.match(app, /path="\/login"/);
  assert.match(app, /path="\/auth\/callback"/);
  assert.match(app, /ProtectedApplication/);
  assert.match(app, /returnTo/);
});
