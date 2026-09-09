import React, { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Plus } from "lucide-react";
import { useFinanceState, useFinanceDispatch } from "../context/FinanceContext.jsx";
import { Card, Button, Modal, Field, Input, ProgressBar } from "../components/ui/primitives.jsx";
import { GoalCard, DebtCard } from "../components/finance/cards.jsx";
import { estimateGoalCompletion } from "../services/financial/goals.js";
import { compareExtraPayment, totalMonthlyInstallments } from "../services/financial/debts.js";
import { getMonthTransactions } from "../services/financial/calculations.js";
import { fmtBs, fmtPct } from "../services/financial/format.js";

const TABS = [
  { id: "objetivos", label: "Objetivos" },
  { id: "emergencia", label: "Fondo de emergencia" },
  { id: "deudas", label: "Deudas" },
];

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
    </div>
  );
}

function Objetivos({ autoOpen }) {
  const state = useFinanceState();
  const dispatch = useFinanceDispatch();
  const [modalOpen, setModalOpen] = useState(autoOpen);
  const [form, setForm] = useState({ name: "", target: "", current: "", monthlyContribution: "" });
  const [simGoal, setSimGoal] = useState(null);
  const [simAporte, setSimAporte] = useState("");

  function guardar(e) {
    e.preventDefault();
    if (!form.name || !form.target) return;
    dispatch({
      type: "ADD_GOAL",
      payload: {
        name: form.name,
        target: Number(form.target),
        current: Number(form.current || 0),
        monthlyContribution: Number(form.monthlyContribution || 0),
      },
    });
    setForm({ name: "", target: "", current: "", monthlyContribution: "" });
    setModalOpen(false);
  }

  const simulacion = simGoal && simAporte ? estimateGoalCompletion(simGoal, Number(simAporte)) : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setModalOpen(true)}>
          <Plus size={14} /> Nuevo objetivo
        </Button>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        {state.goals.map((g) => (
          <GoalCard
            key={g.id}
            goal={g}
            onDelete={() => dispatch({ type: "DELETE_GOAL", payload: g.id })}
            onOpen={() => {
              setSimGoal(g);
              setSimAporte(String(g.monthlyContribution));
            }}
          />
        ))}
        {state.goals.length === 0 && <p className="text-ink-soft text-sm">Aún no tienes objetivos. Crea el primero.</p>}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Nuevo objetivo">
        <form onSubmit={guardar} className="flex flex-col gap-3">
          <Field label="Nombre del objetivo">
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ej. Comprar un auto" required />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Monto objetivo (Bs)">
              <Input type="number" value={form.target} onChange={(e) => setForm({ ...form, target: e.target.value })} required />
            </Field>
            <Field label="Ya tienes (Bs)">
              <Input type="number" value={form.current} onChange={(e) => setForm({ ...form, current: e.target.value })} />
            </Field>
          </div>
          <Field label="Aporte mensual (Bs)">
            <Input type="number" value={form.monthlyContribution} onChange={(e) => setForm({ ...form, monthlyContribution: e.target.value })} />
          </Field>
          <Button type="submit" className="mt-2">Guardar</Button>
        </form>
      </Modal>

      <Modal open={Boolean(simGoal)} onClose={() => setSimGoal(null)} title={`Simulador — ${simGoal?.name || ""}`}>
        <div className="flex flex-col gap-3">
          <Field label="¿Qué pasa si ahorro (Bs/mes)?">
            <Input type="number" value={simAporte} onChange={(e) => setSimAporte(e.target.value)} />
          </Field>
          {simulacion && (
            <p className="text-sm">
              {simulacion.months === Infinity
                ? "Con ese aporte nunca llegarías a la meta."
                : `Alcanzarías el objetivo en ${simulacion.months} meses (${simulacion.date.toLocaleDateString("es-BO", { month: "long", year: "numeric" })}).`}
            </p>
          )}
          <Button
            variant="secondary"
            onClick={() => {
              dispatch({ type: "UPDATE_GOAL", payload: { id: simGoal.id, monthlyContribution: Number(simAporte) } });
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
  const essentialCategoryIds = state.categories.filter((c) => c.essential).map((c) => c.id);
  const essentialMonthly = getMonthTransactions(state, new Date(), "current")
    .filter((t) => t.type === "gasto" && essentialCategoryIds.includes(t.category))
    .reduce((s, t) => s + t.amount, 0);

  const target = essentialMonthly * state.emergencyFund.monthsTarget;
  const progresoPct = target > 0 ? Math.min(1, state.emergencyFund.current / target) : 0;
  const faltante = Math.max(0, target - state.emergencyFund.current);

  return (
    <Card>
      <div className="text-ink-soft text-xs">Gastos esenciales mensuales</div>
      <div className="font-display text-xl font-semibold">{fmtBs(essentialMonthly)}</div>

      <div className="mt-4 text-ink-soft text-xs">Objetivo recomendado ({state.emergencyFund.monthsTarget} meses)</div>
      <div className="font-display text-xl font-semibold">{fmtBs(target)}</div>

      <div className="mt-4">
        <div className="flex justify-between text-sm mb-1">
          <span>Ahorro actual: {fmtBs(state.emergencyFund.current)}</span>
          <span className="text-ink-soft">{fmtPct(progresoPct)}</span>
        </div>
        <ProgressBar value={progresoPct * 100} color="#1F5C56" />
      </div>

      <p className="text-sm mt-3">
        {faltante > 0
          ? `Te faltan ${fmtBs(faltante)} para alcanzar tu objetivo.`
          : "Ya alcanzaste tu fondo de emergencia recomendado."}
      </p>

      <div className="flex flex-wrap gap-2 mt-3">
        {[3, 6].map((m) => (
          <Button
            key={m}
            size="sm"
            variant={state.emergencyFund.monthsTarget === m ? "primary" : "secondary"}
            onClick={() => dispatch({ type: "SET_EMERGENCY_FUND", payload: { monthsTarget: m } })}
          >
            {m} meses
          </Button>
        ))}
      </div>
    </Card>
  );
}

function Deudas() {
  const state = useFinanceState();
  const dispatch = useFinanceDispatch();
  const [form, setForm] = useState({ name: "", entity: "", principal: "", balance: "", rate: "", installment: "", paymentDay: "" });
  const [modalOpen, setModalOpen] = useState(false);
  const [simDebt, setSimDebt] = useState(null);
  const [extra, setExtra] = useState("");

  const totalCuotas = totalMonthlyInstallments(state.debts);
  const comparacion = simDebt && extra ? compareExtraPayment(simDebt, Number(extra)) : null;

  function guardar(e) {
    e.preventDefault();
    if (!form.name || !form.balance || !form.installment) return;
    dispatch({
      type: "ADD_DEBT",
      payload: {
        name: form.name,
        entity: form.entity,
        type: "otro",
        principal: Number(form.principal || form.balance),
        balance: Number(form.balance),
        rate: Number(form.rate || 0),
        installment: Number(form.installment),
        frequency: "mensual",
        paymentDay: Number(form.paymentDay || 1),
        termMonths: null,
        remainingInstallments: null,
      },
    });
    setForm({ name: "", entity: "", principal: "", balance: "", rate: "", installment: "", paymentDay: "" });
    setModalOpen(false);
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="text-ink-soft text-xs">Total de cuotas mensuales</div>
        <div className="font-display text-xl font-semibold">{fmtBs(totalCuotas)}</div>
      </Card>

      <div className="flex justify-end">
        <Button size="sm" onClick={() => setModalOpen(true)}>
          <Plus size={14} /> Nueva deuda
        </Button>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        {state.debts.map((d) => (
          <DebtCard
            key={d.id}
            debt={d}
            onDelete={() => dispatch({ type: "DELETE_DEBT", payload: d.id })}
            onSimulate={() => {
              setSimDebt(d);
              setExtra("");
            }}
          />
        ))}
      </div>

      <p className="text-ink-soft text-xs">
        El simulador usa una aproximación de interés simple mensual sobre el saldo. Una tabla de amortización
        detallada (capital vs. interés mes a mes) queda planificada para la siguiente iteración.
      </p>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Nueva deuda">
        <form onSubmit={guardar} className="flex flex-col gap-3">
          <Field label="Nombre">
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </Field>
          <Field label="Entidad">
            <Input value={form.entity} onChange={(e) => setForm({ ...form, entity: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Saldo actual (Bs)">
              <Input type="number" value={form.balance} onChange={(e) => setForm({ ...form, balance: e.target.value })} required />
            </Field>
            <Field label="Tasa anual (%)">
              <Input type="number" value={form.rate} onChange={(e) => setForm({ ...form, rate: e.target.value })} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Cuota mensual (Bs)">
              <Input type="number" value={form.installment} onChange={(e) => setForm({ ...form, installment: e.target.value })} required />
            </Field>
            <Field label="Día de pago">
              <Input type="number" min="1" max="28" value={form.paymentDay} onChange={(e) => setForm({ ...form, paymentDay: e.target.value })} />
            </Field>
          </div>
          <Button type="submit" className="mt-2">Guardar</Button>
        </form>
      </Modal>

      <Modal open={Boolean(simDebt)} onClose={() => setSimDebt(null)} title={`Simulador — ${simDebt?.name || ""}`}>
        <div className="flex flex-col gap-3">
          <Field label="Pago adicional mensual (Bs)">
            <Input type="number" value={extra} onChange={(e) => setExtra(e.target.value)} />
          </Field>
          {comparacion && (
            <div className="text-sm flex flex-col gap-1">
              <p>Hoy: {comparacion.base.months === Infinity ? "no se termina de pagar así." : `${comparacion.base.months} meses restantes.`}</p>
              <p>Con el pago adicional: {comparacion.withExtra.months === Infinity ? "sigue sin cubrirse el interés." : `${comparacion.withExtra.months} meses restantes.`}</p>
              {comparacion.monthsSaved !== null && (
                <p className="font-medium">
                  Ahorrarías {comparacion.monthsSaved} meses y aproximadamente {fmtBs(comparacion.interestSaved)} en intereses.
                </p>
              )}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
