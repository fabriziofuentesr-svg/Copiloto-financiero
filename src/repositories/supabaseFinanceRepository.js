import { buildEmptyState } from "../data/mockData.js";
import { migrateState } from "../services/migrations.js";
import { RepositoryError } from "./contracts.js";
import { validateMovementWrites } from "../services/financial/movementDates.js";
import { compareFinanceStates } from "../services/import/localMigration.js";

function operationId() {
  return globalThis.crypto?.randomUUID?.() || `operation-${Date.now()}-${Math.random()}`;
}

function translate(error, fallback) {
  if (error?.code === "PGRST301" || error?.message?.toLowerCase().includes("jwt")) return new RepositoryError("session_expired", "Tu sesión venció. Inicia sesión otra vez.", error);
  if (error?.code === "40001") return new RepositoryError("conflict", "Tus datos cambiaron en otro dispositivo. Recarga antes de volver a guardar.", error);
  if (error?.message?.toLowerCase().includes("fetch") || error?.message?.toLowerCase().includes("network")) return new RepositoryError("offline", "No hay conexión. Conservamos los cambios visibles para que puedas reintentarlos.", error);
  return new RepositoryError("remote_error", fallback, error);
}

export function createSupabaseFinanceRepository(client, userId) {
  if (!client || !userId) throw new TypeError("El repositorio remoto necesita cliente y usuario.");
  let revision = 0;
  let planningSupported = false;
  return {
    mode: "supabase",
    async load() {
      const { data, error } = await client.rpc("get_finance_state");
      if (error) throw translate(error, "No pudimos cargar tu información.");
      revision = Number(data?.revision) || 0;
      planningSupported = Array.isArray(data?.state?.monthlyPlans) && Array.isArray(data?.state?.savingsAllocations);
      return migrateState(data?.state || buildEmptyState());
    },
    async apply({ action, previousState, nextState }) {
      validateMovementWrites(previousState, nextState);
      if (!planningSupported && (["SAVE_MONTHLY_PLAN","SAVE_CATEGORY","SAVINGS_OPERATION"].includes(action.type) || nextState.monthlyPlans?.length || nextState.savingsAllocations?.length || nextState.transactions?.some(tx=>tx.planItemId) || JSON.stringify(nextState.categories) !== JSON.stringify(buildEmptyState().categories))) throw new RepositoryError("migration_required", "La planificación todavía no está habilitada en tu cuenta. Tus cambios visibles se conservan; falta actualizar la base de datos.");
      const { data, error } = await client.rpc("apply_finance_state", {
        p_state: nextState,
        p_expected_revision: revision,
        p_operation_id: action.meta?.operationId || operationId(),
      });
      if (error) throw translate(error, "No pudimos guardar los cambios.");
      if (planningSupported && (!Array.isArray(data?.state?.monthlyPlans) || !Array.isArray(data?.state?.savingsAllocations))) throw new RepositoryError("invalid_state", "No pudimos verificar el guardado completo. Conservamos tus cambios para reintentarlos.");
      revision = Number(data?.revision) || revision + 1;
      if(nextState.accounts.some(account=>Math.round(account.balance*100) !== Math.round(data?.state?.accounts?.find(item=>item.id === account.id)?.balance*100))) throw new RepositoryError("reconciliation_failed","El saldo guardado no coincide con el libro esperado. Conservamos tus cambios para revisarlos y reintentarlos.");
      return migrateState(data?.state || nextState);
    },
    async hasRemoteData() {
      const { data, error } = await client.rpc("has_finance_data");
      if (error) throw translate(error, "No pudimos comprobar tus datos guardados.");
      return Boolean(data);
    },
    async getImportStatus(fingerprint) {
      if (!fingerprint) return null;
      const { data, error } = await client.rpc("get_local_import_status", { p_fingerprint: fingerprint });
      if (error) throw translate(error, "No pudimos comprobar una importación anterior.");
      return data || null;
    },
    async importLocal(localState, migrationId, fingerprint) {
      validateMovementWrites(null, localState);
      if (!planningSupported) {
        const loaded=await client.rpc("get_finance_state");
        if(loaded.error) throw translate(loaded.error,"No pudimos verificar la importación.");
        planningSupported=Array.isArray(loaded.data?.state?.monthlyPlans);
        if(!planningSupported) throw new RepositoryError("migration_required","Falta actualizar la base de datos antes de importar tus categorías, planes y aportes. La copia local se conserva.");
      }
      const { data, error } = await client.rpc("import_local_finance_state", {
        p_state: migrateState(localState), p_migration_id: migrationId, p_fingerprint: fingerprint,
      });
      if (error) throw translate(error, "No pudimos importar todos tus datos. Puedes reintentarlo sin duplicarlos.");
      revision = Number(data?.revision) || revision;
      const state = migrateState(data?.state);
      return { ...data, state, verification: compareFinanceStates(localState, state) };
    },
    async exportData() {
      const { data, error } = await client.rpc("get_finance_state");
      if (error) throw translate(error, "No pudimos preparar la exportación.");
      return data?.state || buildEmptyState();
    },
  };
}
