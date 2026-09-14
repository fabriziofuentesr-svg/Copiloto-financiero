import React from "react";
import { Trash2 } from "lucide-react";
import { fmtBs, fmtFecha, fmtPct } from "../../services/financial/format.js";
import { ProgressBar, Badge } from "../ui/primitives.jsx";
import { goalProgress, estimateGoalCompletion } from "../../services/financial/goals.js";

export function AccountCard({ account, currency = account.currency, onDelete }) {
  const isCard = account.type === "tarjeta_credito";
  return (
    <div className="border border-line rounded p-4 flex flex-col gap-1 bg-paper">
      <div className="flex items-center justify-between">
        <span className="font-medium text-sm">{account.name}</span>
        {onDelete && (
          <button onClick={onDelete} className="text-ink-soft hover:text-brick" aria-label="Eliminar">
            <Trash2 size={14} />
          </button>
        )}
      </div>
      <div className={`font-display text-xl font-semibold ${isCard ? "text-brick" : "text-teal"}`}>
        {fmtBs(Math.abs(account.balance), currency)}
      </div>
      <div className="text-ink-soft text-xs">{isCard ? "Saldo utilizado" : "Disponible"}</div>
    </div>
  );
}

export function TransactionItem({ tx, categoryName, accountName, currency = "BOB", onDelete }) {
  const isIngreso = tx.type === "ingreso";
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-dotted border-line last:border-none text-sm">
      <div className="flex-1 min-w-0">
        <div className="truncate">{tx.description}</div>
        <div className="text-ink-soft text-xs truncate">
          {categoryName} · {accountName} · {fmtFecha(tx.date)}
        </div>
      </div>
      <div className={`font-medium tabular-nums ${isIngreso ? "text-teal" : "text-ink"}`}>
        {isIngreso ? "+" : "−"} {fmtBs(tx.amount, currency)}
      </div>
      {onDelete && (
        <button onClick={onDelete} className="text-ink-soft hover:text-brick shrink-0" aria-label="Eliminar">
          <Trash2 size={14} />
        </button>
      )}
    </div>
  );
}

export function GoalCard({ goal, currency = "BOB", onDelete, onOpen, onAdd }) {
  const { restante, progresoPct } = goalProgress(goal);
  const est = estimateGoalCompletion(goal);
  return (
    <div className="border border-line rounded p-4 flex flex-col gap-2 bg-paper">
      <div className="flex items-center justify-between">
        <span className="font-medium text-sm">{goal.name}</span>
        {onDelete && (
          <button onClick={onDelete} className="text-ink-soft hover:text-brick" aria-label="Eliminar">
            <Trash2 size={14} />
          </button>
        )}
      </div>
      <div className="text-ink-soft text-xs">
        {fmtBs(goal.current, currency)} de {fmtBs(goal.target, currency)} · {fmtPct(progresoPct)}
      </div>
      <ProgressBar value={progresoPct * 100} color="#1F5C56" />
      <div className="text-ink-soft text-xs">
        {est.months == null
          ? "Define un aporte mensual para estimar la fecha."
          : `A ${fmtBs(goal.monthlyContribution, currency)}/mes, la alcanzas en ${est.months} meses (${est.date.toLocaleDateString("es-BO", { month: "long", year: "numeric" })}).`}
      </div>
      {onAdd && (
        <button onClick={onAdd} className="text-ochre text-xs underline text-left mt-1">
          Registrar aporte
        </button>
      )}
      {onOpen && (
        <button onClick={onOpen} className="text-ochre text-xs underline text-left mt-1">
          Simular otro aporte
        </button>
      )}
      {restante === 0 && <Badge level="positive">Objetivo alcanzado</Badge>}
    </div>
  );
}

export function DebtCard({ debt, currency = "BOB", onDelete, onSimulate, onPay }) {
  return (
    <div className="border border-line rounded p-4 flex flex-col gap-1.5 bg-paper">
      <div className="flex items-center justify-between">
        <span className="font-medium text-sm">{debt.name}</span>
        {onDelete && (
          <button onClick={onDelete} className="text-ink-soft hover:text-brick" aria-label="Eliminar">
            <Trash2 size={14} />
          </button>
        )}
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
