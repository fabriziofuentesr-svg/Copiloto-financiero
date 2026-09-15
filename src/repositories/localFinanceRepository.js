import { loadState, saveState } from "../services/storage.js";
import { migrateState } from "../services/migrations.js";

export const LOCAL_STATE_KEY = "estado-financiero-v1";

export function createLocalFinanceRepository() {
  return {
    mode: "local",
    async load() { return migrateState(loadState(LOCAL_STATE_KEY)); },
    async apply({ nextState }) {
      if (!saveState(LOCAL_STATE_KEY, nextState)) throw new Error("No se pudo guardar en este navegador.");
      return nextState;
    },
    async importLocal() { return { state: migrateState(loadState(LOCAL_STATE_KEY)), alreadyImported: true }; },
    async hasRemoteData() { return false; },
    async getImportStatus() { return null; },
    async exportData() { return migrateState(loadState(LOCAL_STATE_KEY)); },
    peek() { return loadState(LOCAL_STATE_KEY); },
  };
}
