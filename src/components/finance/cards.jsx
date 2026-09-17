import React from "react";
import { Pencil, Trash2 } from "lucide-react";
import { fmtBs, fmtFecha, fmtPct } from "../../services/financial/format.js";
import { ProgressBar, Badge } from "../ui/primitives.jsx";
import { goalProgress, estimateGoalCompletion } from "../../services/financial/goals.js";

export function AccountCard({ account, currency = account.currency, reserved = 0, onDelete, onEdit }) {
  const isCard = account.type === "tarjeta_credito";
  return (
    <div className="border border-line rounded p-4 flex flex-col gap-1 bg-paper">
      <div className="flex items-center justify-between">
        <span className="font-medium text-sm">{account.name}</span>
        <div className="flex gap-2">{onEdit ? <button onClick={onEdit} className="text-ink-soft hover:text-teal" aria-label={`Editar ${account.name}`}><Pencil size={14} /></button> : null}{onDelete ? <button onClick={onDelete} className="text-ink-soft hover:text-brick" aria-label={`Eliminar ${account.name}`}><Trash2 size={14} /></button> : null}</div>
      </div>
      <div className={`font-display text-xl font-semibold ${isCard ? "text-brick" : "text-teal"}`}>
        {fmtBs(Math.abs(account.balance), currency)}
      </div>
      <div className="text-ink-soft text-xs">{isCard ? "Saldo utilizado" : "Saldo real"}</div>
      {!isCard ? <p className="text-xs text-ink-soft">Apartado {fmtBs(reserved,currency)} · Disponible {fmtBs(account.balance-reserved,currency)}</p> : null}
      {isCard ? <div className="text-ink-soft text-xs">Pago mínimo: {account.minimumPayment ? fmtBs(account.minimumPayment, currency) : "Por completar"} · Día de pago: {account.paymentDay || "Por completar"}</div> : null}
    </div>
  );
}

export function TransactionItem({ tx, categoryName, accountName, currency = "BOB", onDelete, onEdit }) {
  const isIngreso = tx.type === "ingreso" || (tx.type === "ajuste" && Number(tx.balanceDelta) > 0);
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-dotted border-line last:border-none text-sm">
      <div className="flex-1 min-w-0">
        <div className="truncate">{tx.description}</div>
        <div className="text-ink-soft text-xs truncate">
          {categoryName} · {accountName} · {fmtFecha(tx.date)}
        </div>
        {tx.savingsFunding?.amount > 0 ? <Badge level="neutral">Pagado con el plan {tx.savingsFunding.goalName || "de ahorro"} · {fmtBs(tx.savingsFunding.amount,currency)}</Badge> : null}
        {tx.generated ? <Badge level="neutral">{tx.origin === "initial_balance" ? "Generado al crear la cuenta" : "Movimiento generado"}</Badge> : null}
      </div>
      <div className={`font-medium tabular-nums ${isIngreso ? "text-teal" : "text-ink"}`}>
        {isIngreso ? "+" : "−"} {fmtBs(tx.amount, currency)}
      </div>
      {onEdit ? <button onClick={onEdit} className="text-ink-soft hover:text-teal shrink-0" aria-label={`Editar ${tx.description}`}><Pencil size={14} /></button> : null}
      {onDelete ? <button onClick={onDelete} className="text-ink-soft hover:text-brick shrink-0" aria-label={`Eliminar ${tx.description}`}><Trash2 size={14} /></button> : null}
    </div>
  );
}

export function GoalCard({ goal, currency = "BOB", onDelete, onOpen, onAdd, onEdit }) {
  const { restante, progresoPct } = goalProgress(goal);
  const est = estimateGoalCompletion(goal);
  return (
    <div className="border border-line rounded p-4 flex flex-col gap-2 bg-paper">
      <div className="flex items-center justify-between">
        <span className="font-medium text-sm">{goal.name}</span>
        <div className="flex gap-2">{onEdit ? <button onClick={onEdit} className="text-ink-soft hover:text-teal" aria-label={`Editar ${goal.name}`}><Pencil size={14} /></button> : null}{onDelete ? <button onClick={onDelete} className="text-ink-soft hover:text-brick" aria-label={`Archivar ${goal.name}`}><Trash2 size={14} /></button> : null}</div>
      </div>
      <div className="text-ink-soft text-xs">
        {goal.system === "standard_savings" ? `${fmtBs(goal.current,currency)} vinculados a tus cuentas` : `${fmtBs(goal.current,currency)} apartados · ${fmtBs(goal.used || 0,currency)} utilizados para este objetivo · ${fmtBs(goal.target,currency)} de meta · ${fmtPct(progresoPct)}`}
      </div>
      <p className="text-xs text-ink-soft">Aporte previsto pendiente: {fmtBs(goal.plannedPending || 0,currency)}</p>
      {goal.locations?.length ? <p className="text-xs text-ink-soft">{goal.locations.join(" · ")}</p> : null}
      {goal.needsReconciliation ? <p className="text-xs text-brick">Hay avance anterior sin ubicación confirmada. Vincúlalo a sus cuentas reales antes de utilizarlo.</p> : null}
      {goal.system !== "standard_savings" ? <ProgressBar value={progresoPct * 100} color="#1F5C56" /> : null}
      <div className="text-ink-soft text-xs">
        {goal.system === "standard_savings" ? "Dinero existente sin un objetivo específico; puedes reasignarlo a otro plan." : restante === 0 ? "Meta cubierta con dinero apartado o ya utilizado para este objetivo." : est.date == null
          ? "Define un aporte mensual para estimar la fecha."
          : `A ${fmtBs(goal.monthlyContribution,currency)} por ${goal.contributionFrequency === "semanal" ? "semana" : "mes"}, la alcanzas en ${est.periods ?? est.months} ${goal.contributionFrequency === "semanal" ? "semanas" : "meses"} (${est.date.toLocaleDateString("es-BO")}).`}
      </div>
      {onAdd && (
        <button onClick={onAdd} className="text-ochre text-xs underline text-left mt-1">
          Apartar dinero
        </button>
      )}
      {onOpen && goal.system !== "standard_savings" && (
        <button onClick={onOpen} className="text-ochre text-xs underline text-left mt-1">
          Simular otro aporte
        </button>
      )}
      {restante === 0 && goal.system !== "standard_savings" && <Badge level="positive">Objetivo alcanzado</Badge>}
    </div>
  );
}

export function DebtCard({ debt, currency = "BOB", onDelete, onSimulate, onPay, onEdit }) {
  return (
    <div className="border border-line rounded p-4 flex flex-col gap-1.5 bg-paper">
      <div className="flex items-center justify-between">
        <span className="font-medium text-sm">{debt.name}</span>
        <div className="flex gap-2">{onEdit ? <button onClick={onEdit} className="text-ink-soft hover:text-teal" aria-label={`Editar ${debt.name}`}><Pencil size={14} /></button> : null}{onDelete ? <button onClick={onDelete} className="text-ink-soft hover:text-brick" aria-label={`Eliminar ${debt.name}`}><Trash2 size={14} /></button> : null}</div>
      </div>
      <div className="text-ink-soft text-xs">{debt.entity}</div>
      <div className="font-display text-lg font-semibold">{fmtBs(debt.balance, currency)}</div>
      <div className="text-ink-soft text-xs">
        Cuota {fmtBs(debt.installment, currency)} · {debt.rate}% anual
        {debt.remainingInstallments ? ` · ${debt.remainingInstallments} cuotas restantes` : ""}
      </div>
      {onSimulate && (
        <button onClick={onSimulate} className="text-ochre text-xs underline text-left mt-1">
          Simular pago adicional
        </button>
      )}
      {onPay && (
        <button onClick={onPay} className="text-ochre text-xs underline text-left mt-1">
          Registrar pago
        </button>
      )}
    </div>
  );
}

export function InsightCard({ insight, action }) {
  const border = insight.level === "danger" ? "border-l-brick" : insight.level === "warning" ? "border-l-ochre" : "border-l-teal";
  const icon = insight.level === "danger" ? "🔴" : insight.level === "warning" ? "🟡" : "💡";
  return (
    <div className={`border-l-4 ${border} pl-3 py-1`}>
      <div className="font-medium text-sm">
        {icon} {insight.title}
      </div>
      <div className="text-ink-soft text-sm mt-0.5">{insight.detail}</div>
      {action}
    </div>
  );
}

export function AlertBanner({ level = "warning", children }) {
  const styles = {
    danger: "bg-brick/10 border-brick text-brick",
    warning: "bg-ochre/10 border-ochre text-[#8A5F1E]",
    positive: "bg-teal/10 border-teal text-teal",
    neutral: "bg-paper-raised border-line text-ink-soft",
  };
  return <div className={`border rounded px-4 py-3 text-sm ${styles[level]}`}>{children}</div>;
}
