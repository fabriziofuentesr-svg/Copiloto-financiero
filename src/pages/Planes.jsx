import React, { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Plus } from "lucide-react";
import { useFinanceState, useFinanceDispatch } from "../context/FinanceContext.jsx";
import { Card, Button, Modal, Field, Input, ProgressBar } from "../components/ui/primitives.jsx";
import { GoalCard, DebtCard } from "../components/finance/cards.jsx";
import { estimateGoalCompletion } from "../services/financial/goals.js";
import { compareExtraPayment } from "../services/financial/debts.js";
import { getEmergencyFundStatus, getTotalDebtInstallments } from "../services/financial/calculations.js";
import { fmtBs, fmtPct } from "../services/financial/format.js";
import { SectionGuide } from "../components/SectionGuide.jsx";

const TABS = [
  { id: "objetivos", label: "Objetivos" },
  { id: "emergencia", label: "Fondo de emergencia" },
  { id: "deudas", label: "Deudas" },
];

function currencyLabel(currency) {
  return currency === "USD" ? "USD" : "Bs";
}

export default function Planes() {
  const [params] = useSearchParams();
  const [tab, setTab] = useState(params.get("tab") || "objetivos");

  return (
    <div className="flex flex-col gap-5">
      <h1 className="font-display text-2xl font-semibold">Planes</h1>
      <div className="flex gap-1 border-b border-line">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-3 py-2 text-sm -mb-px border-b-2 ${tab === t.id ? "border-ochre font-medium" : "border-transparent text-ink-soft"}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === "objetivos" && <Objetivos autoOpen={Boolean(params.get("nuevo"))} />}
      {tab === "emergencia" && <FondoEmergencia />}
      {tab === "deudas" && <Deudas />}
      <SectionGuide section="plans" />
    </div>
  );
}

function Objetivos({ autoOpen }) {
  const state = useFinanceState();
  const dispatch = useFinanceDispatch();
  const currency = state.profile?.currency || "BOB";
  const unit = currencyLabel(currency);
  const [modalOpen, setModalOpen] = useState(autoOpen);
  const [form, setForm] = useState({ name: "", target: "", current: "", monthlyContribution: "" });
  const [editingGoal, setEditingGoal] = useState(null);
  const [simGoal, setSimGoal] = useState(null);
  const [simAporte, setSimAporte] = useState("");
  const [aporteGoal, setAporteGoal] = useState(null);
  const [aporteMonto, setAporteMonto] = useState("");

  function guardar(e) {
    e.preventDefault();
    const target = Number(form.target);
    const current = Number(form.current || 0);
    const monthlyContribution = Number(form.monthlyContribution || 0);
    if (!form.name.trim() || !Number.isFinite(target) || target <= 0 || !Number.isFinite(current) || current < 0 || !Number.isFinite(monthlyContribution) || monthlyContribution < 0) return;
    dispatch({
      type: editingGoal ? "UPDATE_GOAL" : "ADD_GOAL",
      payload: {
        ...(editingGoal ? { id: editingGoal.id } : {}),
        name: form.name.trim(),
        target,
        current: Math.min(target, current),
        monthlyContribution,
      },
    });
    setForm({ name: "", target: "", current: "", monthlyContribution: "" });
    setEditingGoal(null);
    setModalOpen(false);
  }

  const simulacion = simGoal && simAporte ? estimateGoalCompletion(simGoal, Number(simAporte)) : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => { setEditingGoal(null); setForm({ name: "", target: "", current: "", monthlyContribution: "" }); setModalOpen(true); }}>
          <Plus size={14} /> Nuevo objetivo
        </Button>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        {state.goals.map((g) => (
          <GoalCard
            key={g.id}
            goal={g}
            currency={currency}
            onDelete={() => { if (window.confirm(`Eliminar el objetivo “${g.name}”? Los aportes registrados se conservarán en el historial de ahorro.`)) dispatch({ type: "DELETE_GOAL", payload: g.id }); }}
            onEdit={() => { setEditingGoal(g); setForm({ name: g.name, target: String(g.target), current: String(g.current), monthlyContribution: String(g.monthlyContribution || 0) }); setModalOpen(true); }}
            onAdd={() => {
              setAporteGoal(g);
              setAporteMonto("");
            }}
            onOpen={() => {
              setSimGoal(g);
              setSimAporte(String(g.monthlyContribution));
            }}
          />
        ))}
        {state.goals.length === 0 && <p className="text-ink-soft text-sm">Aún no tienes objetivos. Crea el primero.</p>}
      </div>

      <Modal open={Boolean(aporteGoal)} onClose={() => setAporteGoal(null)} title="Registrar aporte">
        <div className="flex flex-col gap-3">
          <p className="text-sm text-ink-soft">Añade un ahorro real a «{aporteGoal?.name || ""}».</p>
          <Field label="Monto del aporte">
            <Input type="number" min="0.01" step="0.01" value={aporteMonto} onChange={(e) => setAporteMonto(e.target.value)} />
          </Field>
          <Button
            onClick={() => {
              const amount = Number(aporteMonto);
              if (!aporteGoal || !Number.isFinite(amount) || amount <= 0) return;
              dispatch({ type: "ADD_TO_GOAL", payload: { id: aporteGoal.id, amount } });
              setAporteGoal(null);
            }}
          >
            Registrar aporte
          </Button>
        </div>
      </Modal>

      <Modal open={modalOpen} onClose={() => { setModalOpen(false); setEditingGoal(null); }} title={editingGoal ? `Editar objetivo — ${editingGoal.name}` : "Nuevo objetivo"}>
        <form onSubmit={guardar} className="flex flex-col gap-3">
          <Field label="Nombre del objetivo">
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ej. Comprar un auto" required />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={`Monto objetivo (${unit})`}>
              <Input type="number" min="0.01" step="0.01" value={form.target} onChange={(e) => setForm({ ...form, target: e.target.value })} required />
            </Field>
            <Field label={`Ya tienes (${unit})`}>
              <Input type="number" min="0" step="0.01" value={form.current} onChange={(e) => setForm({ ...form, current: e.target.value })} />
            </Field>
          </div>
          <Field label={`Aporte mensual (${unit})`}>
            <Input type="number" min="0" step="0.01" value={form.monthlyContribution} onChange={(e) => setForm({ ...form, monthlyContribution: e.target.value })} />
          </Field>
          <Button type="submit" className="mt-2">{editingGoal ? "Guardar cambios" : "Guardar"}</Button>
        </form>
      </Modal>

      <Modal open={Boolean(simGoal)} onClose={() => setSimGoal(null)} title={`Simulador — ${simGoal?.name || ""}`}>
        <div className="flex flex-col gap-3">
          <Field label={`¿Qué pasa si ahorro (${unit}/mes)?`}>
            <Input type="number" value={simAporte} onChange={(e) => setSimAporte(e.target.value)} />
          </Field>
          {simulacion && (
            <p className="text-sm">
              {simulacion.months == null
                ? "Con ese aporte nunca llegarías a la meta."
                : `Alcanzarías el objetivo en ${simulacion.months} meses (${simulacion.date.toLocaleDateString("es-BO", { month: "long", year: "numeric" })}).`}
            </p>
          )}
          <Button
            variant="secondary"
            onClick={() => {
              const monthlyContribution = Number(simAporte);
              if (!Number.isFinite(monthlyContribution) || monthlyContribution < 0) return;
              dispatch({ type: "UPDATE_GOAL", payload: { id: simGoal.id, monthlyContribution } });
              setSimGoal(null);
            }}
          >
            Usar este aporte como mi plan
          </Button>
        </div>
      </Modal>
    </div>
  );
}

function FondoEmergencia() {
  const state = useFinanceState();
  const dispatch = useFinanceDispatch();
  const currency = state.profile?.currency || "BOB";
  const unit = currencyLabel(currency);
  const { essentialMonthly, target, progresoPct, faltante, current, hasExpenses } = getEmergencyFundStatus(state);
  const [aporte, setAporte] = useState("");

  return (
    <Card>
      <div className="text-ink-soft text-xs">Gastos esenciales mensuales</div>
      <div className="font-display text-xl font-semibold">{fmtBs(essentialMonthly, currency)}</div>

      <div className="mt-4 text-ink-soft text-xs">Objetivo recomendado ({state.emergencyFund?.monthsTarget || 3} meses)</div>
      <div className="font-display text-xl font-semibold">{fmtBs(target, currency)}</div>

      <div className="mt-4">
        <div className="flex justify-between text-sm mb-1">
          <span>Ahorro actual: {fmtBs(current, currency)}</span>
          <span className="text-ink-soft">{fmtPct(progresoPct)}</span>
        </div>
        <ProgressBar value={progresoPct * 100} color="#1F5C56" />
      </div>


      {!hasExpenses ? (
        <p className="text-sm mt-3 text-ink-soft">Registra al menos un gasto esencial para calcular tu objetivo recomendado.</p>
      ) : (
        <p className="text-sm mt-3">
          {faltante > 0
            ? "Te faltan " + fmtBs(faltante, currency) + " para alcanzar tu objetivo."
            : "Ya alcanzaste tu fondo de emergencia recomendado."}
        </p>
      )}
      <div className="flex flex-wrap gap-2 mt-3">
        {[3, 6].map((m) => (
          <Button
            key={m}
            size="sm"
            variant={(state.emergencyFund?.monthsTarget || 3) === m ? "primary" : "secondary"}
            onClick={() => dispatch({ type: "SET_EMERGENCY_FUND", payload: { monthsTarget: m, configured: true } })}
          >
            {m} meses
          </Button>
        ))}
      </div>
      <div className="flex gap-2 items-end mt-4">
        <Field label={`Añadir ahorro actual (${unit})`}>
          <Input type="number" min="0.01" step="0.01" value={aporte} onChange={(e) => setAporte(e.target.value)} />
        </Field>
        <Button
          size="sm"
          onClick={() => {
            const amount = Number(aporte);
            if (!Number.isFinite(amount) || amount <= 0) return;
            dispatch({ type: "ADD_TO_EMERGENCY_FUND", payload: { amount } });
            setAporte("");
          }}
        >
          Registrar ahorro
        </Button>
      </div>
    </Card>
  );
}

function Deudas() {
  const state = useFinanceState();
  const dispatch = useFinanceDispatch();
  const currency = state.profile?.currency || "BOB";
  const unit = currencyLabel(currency);
  const [form, setForm] = useState({ name: "", entity: "", principal: "", balance: "", rate: "", installment: "", paymentDay: "", linkedAccountId: "" });
  const [modalOpen, setModalOpen] = useState(false);
  const [editingDebt, setEditingDebt] = useState(null);
  const [simDebt, setSimDebt] = useState(null);
  const [extra, setExtra] = useState("");
  const [payDebt, setPayDebt] = useState(null);
  const [payAmount, setPayAmount] = useState("");
  const [payAccountId, setPayAccountId] = useState("");

  const totalCuotas = getTotalDebtInstallments(state);
  const creditCards = state.accounts.filter((account) => account.type === "tarjeta_credito" && Number(account.balance) < 0);
  const comparacion = simDebt && extra ? compareExtraPayment(simDebt, Number(extra)) : null;

  function guardar(e) {
    e.preventDefault();
    const balance = Number(form.balance);
    const installment = Number(form.installment);
    const rate = Number(form.rate || 0);
    const paymentDay = Number(form.paymentDay || 1);
    if (!form.name.trim() || !Number.isFinite(balance) || balance <= 0 || !Number.isFinite(installment) || installment <= 0 || installment > balance || !Number.isFinite(rate) || rate < 0 || rate > 300 || paymentDay < 1 || paymentDay > 28) return;
    dispatch({
      type: editingDebt ? "UPDATE_DEBT" : "ADD_DEBT",
      payload: {
        ...(editingDebt ? { id: editingDebt.id } : {}),
        name: form.name.trim(),
        entity: form.entity,
        type: "otro",
        principal: Number(form.principal || form.balance),
        balance,
        rate,
        installment,
        frequency: "mensual",
        paymentDay,
        termMonths: null,
        remainingInstallments: null,
        linkedAccountId: form.linkedAccountId || null,
      },
    });
    setForm({ name: "", entity: "", principal: "", balance: "", rate: "", installment: "", paymentDay: "", linkedAccountId: "" });
    setEditingDebt(null);
    setModalOpen(false);
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="text-ink-soft text-xs">Total de cuotas mensuales</div>
        <div className="font-display text-xl font-semibold">{fmtBs(totalCuotas, currency)}</div>
      </Card>

      <div className="flex justify-end">
        <Button size="sm" onClick={() => { setEditingDebt(null); setForm({ name: "", entity: "", principal: "", balance: "", rate: "", installment: "", paymentDay: "", linkedAccountId: "" }); setModalOpen(true); }}>
          <Plus size={14} /> Nueva deuda
        </Button>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        {state.debts.map((d) => (
          <DebtCard
            key={d.id}
            debt={d}
            currency={currency}
            onDelete={() => { if (window.confirm(`Eliminar la deuda “${d.name}”? Esta acción quitará sus cuotas futuras del análisis.`)) dispatch({ type: "DELETE_DEBT", payload: d.id }); }}
            onEdit={() => { setEditingDebt(d); setForm({ name: d.name, entity: d.entity || "", principal: String(d.principal || d.balance), balance: String(d.balance), rate: String(d.rate || 0), installment: String(d.installment), paymentDay: String(d.paymentDay || 1), linkedAccountId: d.linkedAccountId || "" }); setModalOpen(true); }}
            onPay={() => {
              setPayDebt(d);
              setPayAmount("");
              setPayAccountId(state.accounts.find((a) => a.type !== "tarjeta_credito")?.id || "");
            }}
            onSimulate={() => {
              setSimDebt(d);
              setExtra("");
            }}
          />
        ))}
        {creditCards.map((card) => (
          <Card key={card.id}>
            <div className="flex justify-between gap-3"><div><p className="font-medium">{card.name}</p><p className="text-xs text-ink-soft">Tarjeta administrada desde Cuentas</p></div><span className="font-semibold">{fmtBs(Math.abs(card.balance), currency)}</span></div>
            <div className="text-xs text-ink-soft mt-3">Pago mínimo: {card.minimumPayment ? fmtBs(card.minimumPayment, currency) : "falta completar"} · Día de pago: {card.paymentDay || "falta completar"}</div>
          </Card>
        ))}
      </div>

      <details className="text-ink-soft text-xs"><summary className="cursor-pointer font-medium">Cómo se estima el interés</summary><p className="mt-1">El simulador usa una aproximación mensual sobre el saldo; el resultado puede diferir del plan de pagos de tu entidad.</p></details>

      <Modal open={Boolean(payDebt)} onClose={() => setPayDebt(null)} title="Registrar pago">
        <div className="flex flex-col gap-3">
          <p className="text-sm text-ink-soft">Registra un pago para reducir el saldo de «{payDebt?.name || ""}».</p>
          <Field label="Cuenta desde la que pagas">
            <select
              className="w-full rounded border border-line bg-paper px-3 py-2 text-sm"
              value={payAccountId}
              onChange={(e) => setPayAccountId(e.target.value)}
            >
              <option value="">Selecciona una cuenta</option>
              {state.accounts.filter((a) => a.type !== "tarjeta_credito").map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Monto del pago">
            <Input type="number" min="0.01" step="0.01" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} />
          </Field>
          <Button
            onClick={() => {
              const amount = Number(payAmount);
              if (!payDebt || !payAccountId || !Number.isFinite(amount) || amount <= 0) return;
              dispatch({ type: "PAY_DEBT", payload: { id: payDebt.id, amount, accountId: payAccountId } });
              setPayDebt(null);
            }}
          >
            Registrar pago
          </Button>
        </div>
      </Modal>

      <Modal open={modalOpen} onClose={() => { setModalOpen(false); setEditingDebt(null); }} title={editingDebt ? `Editar deuda — ${editingDebt.name}` : "Nueva deuda"}>
        <form onSubmit={guardar} className="flex flex-col gap-3">
          <Field label="Nombre">
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </Field>
          <Field label="Entidad">
            <Input value={form.entity} onChange={(e) => setForm({ ...form, entity: e.target.value })} />
          </Field>
          {creditCards.length ? <Field label="Tarjeta vinculada (evita duplicar la deuda)"><select className="w-full rounded border border-line bg-paper-raised px-3 py-2 text-sm" value={form.linkedAccountId} onChange={(e) => setForm({ ...form, linkedAccountId: e.target.value })}><option value="">No corresponde a una tarjeta</option>{creditCards.map((card) => <option key={card.id} value={card.id}>{card.name}</option>)}</select></Field> : null}
          <div className="grid grid-cols-2 gap-3">
            <Field label={`Saldo actual (${unit})`}>
              <Input type="number" min="0.01" step="0.01" value={form.balance} onChange={(e) => setForm({ ...form, balance: e.target.value })} required />
            </Field>
            <Field label="Tasa anual (%)">
              <Input type="number" min="0" max="300" step="0.01" value={form.rate} onChange={(e) => setForm({ ...form, rate: e.target.value })} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label={`Cuota mensual (${unit})`}>
              <Input type="number" min="0.01" step="0.01" value={form.installment} onChange={(e) => setForm({ ...form, installment: e.target.value })} required />
            </Field>
            <Field label="Día de pago">
              <Input type="number" min="1" max="28" value={form.paymentDay} onChange={(e) => setForm({ ...form, paymentDay: e.target.value })} />
            </Field>
          </div>
          <Button type="submit" className="mt-2">{editingDebt ? "Guardar cambios" : "Guardar"}</Button>
        </form>
      </Modal>

      <Modal open={Boolean(simDebt)} onClose={() => setSimDebt(null)} title={`Simulador — ${simDebt?.name || ""}`}>
        <div className="flex flex-col gap-3">
          <Field label={`Pago adicional mensual (${unit})`}>
            <Input type="number" value={extra} onChange={(e) => setExtra(e.target.value)} />
          </Field>
          {comparacion && (
            <div className="text-sm flex flex-col gap-1">
              <p>Hoy: {comparacion.base.months === Infinity ? "no se termina de pagar así." : `${comparacion.base.months} meses restantes.`}</p>
              <p>Con el pago adicional: {comparacion.withExtra.months === Infinity ? "sigue sin cubrirse el interés." : `${comparacion.withExtra.months} meses restantes.`}</p>
              {comparacion.monthsSaved !== null && (
                <p className="font-medium">
                  Ahorrarías {comparacion.monthsSaved} meses y aproximadamente {fmtBs(comparacion.interestSaved, currency)} en intereses.
                </p>
              )}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
