import React, { useState } from "react";
import { Button, Modal } from "./ui/primitives.jsx";
import { useFinanceMeta } from "../context/FinanceContext.jsx";

export function LocalMigrationPrompt() {
  const { migration, importLocal, dismissMigration, removeLocalCopy } = useFinanceMeta();
  const [showSummary, setShowSummary] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const visible = migration.available && !["dismissed", "idle"].includes(migration.status);
  return <Modal open={visible} onClose={migration.status === "running" ? undefined : dismissMigration} title="Vincular datos de este navegador">
    <div className="flex flex-col gap-4">
      <p>Encontramos datos guardados como invitado. ¿Quieres vincularlos con tu cuenta?</p>
      <p className="text-sm text-ink-soft">La copia local se conservará después de verificar la importación.</p>
      {migration.invalid ? <p role="alert" className="rounded bg-brick/10 p-3 text-sm text-brick">Los datos locales no tienen un formato compatible. No se realizó ningún cambio.</p> : null}
      {migration.remoteExists ? <p role="alert" className="rounded bg-ochre/10 p-3 text-sm">Tu cuenta ya contiene información remota. No la combinaremos ni reemplazaremos automáticamente. Conserva ambas copias hasta disponer de una pantalla de conciliación registro por registro.</p> : null}
      {showSummary && migration.summary ? <dl className="grid grid-cols-2 gap-2 rounded bg-paper-raised p-3 text-sm"><dt>Cuentas</dt><dd>{migration.summary.accounts}</dd><dt>Movimientos</dt><dd>{migration.summary.transactions}</dd><dt>Objetivos</dt><dd>{migration.summary.goals}</dd><dt>Deudas</dt><dd>{migration.summary.debts}</dd><dt>Recurrentes</dt><dd>{migration.summary.recurring}</dd><dt>Configuración financiera</dt><dd>{migration.summary.settings}</dd></dl> : null}
      {migration.error ? <p role="alert" className="rounded bg-brick/10 p-3 text-sm text-brick">{migration.error}</p> : null}
      {migration.status === "completed" ? <p role="status" className="rounded bg-teal/10 p-3 text-sm text-teal">{migration.previousImport ? "Estos datos ya fueron importados y conciliados anteriormente." : "Importación completada y conciliada."} La copia del navegador todavía se conserva.</p> : null}
      <div className="flex flex-wrap gap-2">
        {migration.status !== "completed" && !confirming ? <Button disabled={migration.invalid || migration.remoteExists || migration.status === "running"} onClick={() => { setShowSummary(true); setConfirming(true); }}>Importar mis datos</Button> : null}
        {confirming ? <><Button disabled={migration.status === "running"} onClick={async () => { await importLocal(); setConfirming(false); }}>{migration.status === "running" ? "Importando…" : "Confirmar importación"}</Button><Button variant="secondary" disabled={migration.status === "running"} onClick={() => setConfirming(false)}>Cancelar</Button></> : null}
        {migration.status === "completed" ? <Button variant="danger" onClick={() => { if (window.confirm("La importación ya terminó. ¿Eliminar ahora la copia financiera guardada en este navegador?")) removeLocalCopy(); }}>Eliminar copia local</Button> : null}
        <Button variant="secondary" disabled={!migration.summary} onClick={() => setShowSummary((value) => !value)}>Ver resumen</Button>
        <Button variant="ghost" disabled={migration.status === "running"} onClick={dismissMigration}>{migration.remoteExists ? "Empezar con una cuenta vacía" : "Decidir más tarde"}</Button>
      </div>
    </div>
  </Modal>;
}
