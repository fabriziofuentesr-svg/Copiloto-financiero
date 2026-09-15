import { loadState, saveState } from "../services/storage.js";
import { migrateState } from "../services/migrations.js";

export const LOCAL_STATE_KEY = "estado-financiero-v1";
export const GUEST_STATE_KEY = "invitado-financiero-v1";

export function createLocalFinanceRepository(key = GUEST_STATE_KEY) {
  return {
    mode: "local",
    storageKey: key,
    async load() { return migrateState(loadState(key)); },
    async apply({ nextState }) {
      const guestState = { ...nextState, localOwner: { type: "guest", version: 1 } };
      if (!saveState(key, guestState)) throw new Error("No se pudo guardar en este navegador.");
      return guestState;
    },
    async importLocal() { return { state: migrateState(loadState(key)), alreadyImported: true }; },
    async hasRemoteData() { return false; },
    async getImportStatus() { return null; },
    async exportData() { return migrateState(loadState(key)); },
    peek() { return loadState(key); },
  };
}
