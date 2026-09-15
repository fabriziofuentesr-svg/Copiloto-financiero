export class RepositoryError extends Error {
  constructor(code, userMessage, cause) {
    super(userMessage);
    this.name = "RepositoryError";
    this.code = code;
    this.userMessage = userMessage;
    this.cause = cause;
  }
}

export const DATA_STATUS = Object.freeze({ IDLE: "idle", LOADING: "loading", SAVING: "saving", SAVED: "saved", ERROR: "error", SESSION_EXPIRED: "session_expired" });

export function assertFinanceRepository(repository) {
  for (const method of ["load", "apply", "importLocal", "hasRemoteData", "getImportStatus", "exportData"]) {
    if (typeof repository?.[method] !== "function") throw new TypeError(`Repositorio financiero incompleto: ${method}`);
  }
  return repository;
}
