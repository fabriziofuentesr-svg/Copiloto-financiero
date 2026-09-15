import React from "react";
import { useFinanceMeta } from "../context/FinanceContext.jsx";

export function DataStatus() {
  const { status, message, clearMessage } = useFinanceMeta();
  if (status === "idle") return null;
  const labels = { loading: "Cargando información…", saving: "Guardando…", saved: "Guardado", error: message || "No pudimos completar la operación.", session_expired: "Tu sesión venció. Vuelve a iniciar sesión." };
  return <div role={status === "error" || status === "session_expired" ? "alert" : "status"} className="fixed right-4 top-4 z-50 rounded border border-line bg-paper-raised px-4 py-2 text-sm shadow-card">
    {labels[status] || status}
    {message ? <button aria-label="Cerrar mensaje" className="ml-3 text-ink-soft" onClick={clearMessage}>×</button> : null}
  </div>;
}

