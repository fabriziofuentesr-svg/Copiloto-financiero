import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { AUTH_STATUS, safeReturnPath, authUiState, publicAuthError, validateSignIn, validateSignUp } from "../src/auth/authState.js";
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
  assert.equal(authUiState({ loading: false, user: null }), "unauthenticated");
  assert.equal(authUiState({ loading: false, user: null, guest: true }), "guest");
  assert.equal(authUiState({ loading: false, user: { id: "a" } }), "authenticated");
  assert.deepEqual(Object.values(AUTH_STATUS), ["loading", "authenticated", "guest", "unauthenticated"]);
});

test("inicio de sesión y registro validan sin enviar formularios incompletos", () => {
  assert.deepEqual(validateSignIn({ email: "mal", password: "" }), { email: "Ingresa un correo electrónico válido.", password: "Ingresa tu contraseña." });
  assert.deepEqual(validateSignUp({ name: "", email: "ana@example.com", password: "123", confirmation: "456" }), {
    password: "La contraseña debe tener al menos 6 caracteres.", name: "Ingresa tu nombre.", confirmation: "Las contraseñas no coinciden.",
  });
  assert.deepEqual(validateSignUp({ name: "Ana", email: "ana@example.com", password: "secreto", confirmation: "secreto" }), {});
  assert.equal(publicAuthError({ message: "Invalid login credentials" }), "No pudimos completar el acceso. Revisa los datos e intenta nuevamente.");
});

test("el adaptador local conserva el contrato y los datos anteriores", async () => {
  globalThis.localStorage = memoryStorage();
  const repository = assertFinanceRepository(createLocalFinanceRepository());
  const state = buildEmptyState();
  state.profile.name = "Ana";
  await repository.apply({ nextState: state });
  assert.equal((await repository.load()).profile.name, "Ana");
  assert.deepEqual((await repository.load()).localOwner, { type: "guest", version: 1 });
  assert.equal(globalThis.localStorage.getItem("copiloto-financiero:estado-financiero-v1"), null);
});

test("los datos del invitado permanecen aislados y se detectan para importación", async () => {
  globalThis.localStorage = memoryStorage();
  const state = buildEmptyState(); state.profile.name = "Invitado"; state.profile.onboardingCompleted = true;
  await createLocalFinanceRepository().apply({ nextState: state });
  const migration = inspectLocalMigration();
  assert.equal(migration.available, true);
  assert.equal(migration.sourceKey, "invitado-financiero-v1");
  assert.equal(migration.state.profile.name, "Invitado");
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

test("la experiencia de acceso contiene correo, registro, Google e invitado", async () => {
  const [login, auth, factory, settings, migrationPrompt] = await Promise.all([
    readFile(new URL("../src/pages/Login.jsx", import.meta.url), "utf8"),
    readFile(new URL("../src/auth/AuthContext.jsx", import.meta.url), "utf8"),
    readFile(new URL("../src/repositories/factory.js", import.meta.url), "utf8"),
    readFile(new URL("../src/pages/Configuracion.jsx", import.meta.url), "utf8"),
    readFile(new URL("../src/components/LocalMigrationPrompt.jsx", import.meta.url), "utf8"),
  ]);
  for (const text of ["Iniciar sesión", "Regístrate", "Continuar con Google", "Continuar como invitado", "Crear una cuenta", "¿Olvidaste tu contraseña?"]) assert.match(login, new RegExp(text.replace(/[?]/g, "\\?")));
  assert.match(auth, /signInWithPassword/); assert.match(auth, /signUpWithPassword/); assert.match(auth, /resetPasswordForEmail/);
  assert.match(factory, /status === "guest"/); assert.match(factory, /status !== "authenticated"/);
  assert.match(settings, /Eliminar datos de invitado/); assert.match(settings, /Cuenta y sesión/);
  assert.match(migrationPrompt, /Confirmar importación/); assert.match(migrationPrompt, /Decidir más tarde/);
  assert.doesNotMatch(auth, /localStorage.*password|password.*localStorage/i);
});
