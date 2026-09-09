// Polyfill de `window.storage` para ejecutar la app fuera del entorno de
// artifacts de Claude (donde `window.storage` existe de forma nativa).
// Implementa la misma interfaz async (get/set/delete/list) usando
// localStorage, para que App.jsx funcione sin ningún cambio.
(function installStorageShim() {
  if (typeof window === "undefined") return;
  if (window.storage) return; // ya provisto por el entorno (ej. Claude.ai)

  const prefix = "copiloto-financiero:";
  const keyFor = (key, shared) => `${prefix}${shared ? "shared:" : "personal:"}${key}`;

  window.storage = {
    async get(key, shared = false) {
      const raw = localStorage.getItem(keyFor(key, shared));
      if (raw === null) return null;
      return { key, value: raw, shared };
    },
    async set(key, value, shared = false) {
      localStorage.setItem(keyFor(key, shared), value);
      return { key, value, shared };
    },
    async delete(key, shared = false) {
      const existed = localStorage.getItem(keyFor(key, shared)) !== null;
      localStorage.removeItem(keyFor(key, shared));
      return { key, deleted: existed, shared };
    },
    async list(keyPrefix = "", shared = false) {
      const scope = `${prefix}${shared ? "shared:" : "personal:"}`;
      const keys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(scope + keyPrefix)) {
          keys.push(k.slice(scope.length));
        }
      }
      return { keys, prefix: keyPrefix, shared };
    },
  };
})();
