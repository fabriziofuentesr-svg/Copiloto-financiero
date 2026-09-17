import React, { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Plus } from "lucide-react";
import { useFinanceState, useFinanceDispatch } from "../context/FinanceContext.jsx";
import { Card, Button, Modal, Field, Input, ProgressBar, Select , MoneyInput } from "../components/ui/primitives.jsx";
import { GoalCard, DebtCard } from "../components/finance/cards.jsx";
import { goalUsed } from "../services/financial/savingsFunding.js";
import { monthlyPlanStatus } from "../services/financial/monthlyPlan.js";
import { estimateGoalCompletion } from "../services/financial/goals.js";
import { compareExtraPayment } from "../services/financial/debts.js";
import { getEmergencyFundStatus, getTotalDebtInstallments } from "../services/financial/calculations.js";
import { fmtBs, fmtPct } from "../services/financial/format.js";
import { SectionGuide } from "../components/SectionGuide.jsx";
import { SavingsOperationForm } from "../components/finance/SavingsOperationForm.jsx";
import { Link, useNavigate } from "react-router-dom";

function currencyLabel(currency) {
  return currency === "USD" ? "USD" : "Bs.";
}

export default function Planes() {
  const [params] = useSearchParams();


  return (
    <div className="flex flex-col gap-5">
      <h1 className="font-display text-2xl font-semibold">Planes de Ahorro</h1>
      <p className="text-sm text-ink-soft">Objetivos de varios meses, con dinero asignado a cuentas y aportes trazables.</p>
      <Objetivos autoOpen={Boolean(params.get("nuevo"))} />
      <Link to="/mi-mes" className="text-sm underline">Consultar cuotas y compromisos en Mi mes</Link>
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
  const [form, setForm] = useState({ name: "", target: "", current: "", monthlyContribution: "", contributionFrequency: "mensual" });
  const [editingGoal, setEditingGoal] = useState(null);
  const [simGoal, setSimGoal] = useState(null);
  const [simAporte, setSimAporte] = useState("");
  const [aporteGoal, setAporteGoal] = useState(null);


  async function guardar(e) {
    e.preventDefault();
    const target = Number(form.target);
    const current = editingGoal?.current || 0;
    const monthlyContribution = Number(form.monthlyContribution || 0);
    if (!form.name.trim() || !Number.isFinite(target) || target <= 0 || !Number.isFinite(current) || current < 0 || !Number.isFinite(monthlyContribution) || monthlyContribution < 0) return;
    const result = await dispatch({
      type: editingGoal ? "UPDATE_GOAL" : "ADD_GOAL",
      payload: {
        ...(editingGoal ? { id: editingGoal.id } : {}),
        name: form.name.trim(),
        target,
        current,
        monthlyContribution,
        contributionFrequency: form.contributionFrequency || "mensual",
      },
    });
    if (result?.ok === false) return;
    setForm({ name: "", target: "", current: "", monthlyContribution: "", contributionFrequency: "mensual" });
    setEditingGoal(null);
    setModalOpen(false);
  }

  const status=monthlyPlanStatus(state);
  const simulacion = simGoal && simAporte ? estimateGoalCompletion(simGoal, Number(simAporte)) : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => { setEditingGoal(null); setForm({ name: "", target: "", current: "", monthlyContribution: "", contributionFrequency: "mensual" }); setModalOpen(true); }}>
          <Plus size={14} /> Nuevo plan de ahorro
        </Button>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        {state.goals.filter(g=>!g.archived).map((g) => (
          <GoalCard
            key={g.id}
            goal={{...g,used:goalUsed(state,g.id),plannedPending:status.savings?.find(row=>row.goalId===g.id)?.pending || 0,locations:state.savingsAllocations.filter(row=>row.goalId===g.id).map(row=>`${state.accounts.find(account=>account.id===row.accountId)?.name}: ${fmtBs(row.amount,currency)}`)}}
            currency={currency}
            onDelete={g.system === "standard_savings" ? undefined : () => { if (state.savingsAllocations.some(item=>item.goalId === g.id && item.amount > 0)) { window.alert("Libera primero los aportes vinculados a este plan."); return; } if (window.confirm(`Archivar el objetivo “${g.name}”? Se conservarán sus aportes y gastos. Los aportes previstos pendientes se cancelarán.`)) dispatch({ type: "ARCHIVE_GOAL", payload: g.id }); }}
            onEdit={g.system === "standard_savings" ? undefined : () => { setEditingGoal(g); setForm({ name: g.name, target: String(g.target), current: String(g.current), monthlyContribution: String(g.monthlyContribution || 0), contributionFrequency: g.contributionFrequency || "mensual" }); setModalOpen(true); }}
            onAdd={() => {
              setAporteGoal(g);

            }}
            onOpen={() => {
              setSimGoal(g);
              setSimAporte(String(g.monthlyContribution));
            }}
          />
        ))}
        {state.goals.length === 0 && <p className="text-ink-soft text-sm">Aún no tienes objetivos. Crea el primero.</p>}
      </div>

      <details><summary>Historial de apartados y usos</summary>{state.savingsContributions.map(event=><p key={event.id} className="text-xs mt-2">{event.date} · {event.goalName || state.goals.find(goal=>goal.id===event.linkedGoalId)?.name} · {{protect:"Apartado",release:"Liberado",reassign:"Reasignado",move:"Trasladado entre cuentas",reconcile:"Ubicación conciliada",initial_protection:"Ahorro inicial confirmado",transfer:"Transferido y apartado"}[event.method] || "Apartado"} · {fmtBs(event.amount,currency)}</p>)}{state.transactions.filter(tx=>tx.savingsFunding?.amount>0).map(tx=><p key={tx.id} className="text-xs mt-2">{tx.date} · Utilizado para {tx.savingsFunding.goalName || state.goals.find(goal=>goal.id===tx.savingsFunding.goalId)?.name} · {tx.description} · {fmtBs(tx.savingsFunding.amount,currency)}</p>)}</details>
      {state.goals.filter(goal=>goal.archived).length ? <details><summary>Planes archivados</summary>{state.goals.filter(goal=>goal.archived).map(goal=><p key={goal.id} className="text-sm">{goal.name} · {fmtBs(goalUsed(state,goal.id),currency)} utilizados para el objetivo</p>)}</details> : null}
      <Modal open={Boolean(aporteGoal)} onClose={() => setAporteGoal(null)} title="Registrar aporte">
        <SavingsOperationForm key={aporteGoal?.id} goalId={aporteGoal?.id} onSuccess={()=>setAporteGoal(null)} />
      </Modal>

      <Modal open={modalOpen} onClose={() => { setModalOpen(false); setEditingGoal(null); }} title={editingGoal ? `Editar plan de ahorro — ${editingGoal.name}` : "Nuevo plan de ahorro"}>
        <form onSubmit={guardar} className="flex flex-col gap-3">
          <Field label="Nombre del plan de ahorro">
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ej. Comprar un auto" required />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={`Monto objetivo (${unit})`}>
              <MoneyInput currency={state.profile.currency} type="number" min="0.01" step="0.01" value={form.target} onChange={(e) => setForm({ ...form, target: e.target.value })} required />
            </Field>
            <Field label={`Ya tienes (${unit})`}>
              <Input type="number" value={editingGoal?.current || 0} disabled />
            </Field>
          </div>
          <p className="text-xs text-ink-soft">El avance se actualiza al registrar aportes respaldados por cuentas. Los avances anteriores se conservan; no se consideran dinero protegido hasta vincular aportes.</p>
          <Field label={`Aporte por periodo (${unit})`}>
            <MoneyInput currency={state.profile.currency} type="number" min="0" step="0.01" value={form.monthlyContribution} onChange={(e) => setForm({ ...form, monthlyContribution: e.target.value })} />
          </Field>
          <Field label="Frecuencia del aporte previsto"><Select value={form.contributionFrequency || "mensual"} onChange={event=>setForm({...form,contributionFrequency:event.target.value})}><option value="mensual">Mensual</option><option value="semanal">Semanal</option></Select></Field><p className="text-xs text-ink-soft">Es una intención; no crea aportes ni transferencias automáticas.</p>
          <Button type="submit" className="mt-2">{editingGoal ? "Guardar cambios" : "Guardar"}</Button>
        </form>
      </Modal>

      <Modal open={Boolean(simGoal)} onClose={() => setSimGoal(null)} title={`Simulador — ${simGoal?.name || ""}`}>
        <div className="flex flex-col gap-3">
          <Field label={`¿Qué pasa si ahorro (${unit}/${simGoal?.contributionFrequency === "semanal" ? "semana" : "mes"})?`}>
            <Input type="number" value={simAporte} onChange={(e) => setSimAporte(e.target.value)} />
          </Field>
          {simulacion && (
            <p className="text-sm">
              {simulacion.date == null
                ? "Con ese aporte nunca llegarías a la meta."
                : `Alcanzarías el objetivo en ${simulacion.periods ?? simulacion.months} ${simGoal.contributionFrequency === "semanal" ? "semanas" : "meses"} (${simulacion.date.toLocaleDateString("es-BO", { month: "long", year: "numeric" })}).`}
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

export function FondoEmergencia() {
  const state = useFinanceState();
  const dispatch = useFinanceDispatch();
  const currency = state.profile?.currency || "BOB";
  const unit = currencyLabel(currency);
  const { essentialMonthly, target, progresoPct, faltante, current, hasExpenses, known } = getEmergencyFundStatus(state);

  return (
    <Card>
      <div className="text-ink-soft text-xs">Gastos esenciales mensuales</div>
      <div className="font-display text-xl font-semibold">{fmtBs(essentialMonthly, currency)}</div>

      <div className="mt-4 text-ink-soft text-xs">Objetivo recomendado ({state.emergencyFund?.monthsTarget || 3} meses)</div>
      <div className="font-display text-xl font-semibold">{fmtBs(target, currency)}</div>

      <div className="mt-4">
        <div className="flex justify-between text-sm mb-1">
          <span>{known ? `Ahorro utilizable: ${fmtBs(current, currency)}` : "Ahorros para imprevistos: no informados"}</span>
          {known ? <span className="text-ink-soft">{fmtPct(progresoPct)}</span> : null}
        </div>
        {known ? <ProgressBar value={progresoPct * 100} color="#1F5C56" /> : null}
      </div>


      {!known ? <p className="text-sm mt-3 text-ink-soft">Indica en el Plan del mes si podrías utilizar ahorros ante un imprevisto. No necesitas crear un fondo separado.</p> : !hasExpenses ? (
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
      <p className="text-xs text-ink-soft mt-4">El fondo anterior se conserva como referencia. En Mi mes indica la cuenta o el plan que respalda tus ahorros para imprevistos.</p><Link to="/mi-mes?config=health" className="text-sm underline mt-3 inline-block">Configurar ahorros para imprevistos</Link>
    </Card>
  );
}

export function Deudas() {
  const navigate=useNavigate();
  const state = useFinanceState();
  const dispatch = useFinanceDispatch();
  const currency = state.profile?.currency || "BOB";
  const unit = currencyLabel(currency);
  const [form, setForm] = useState({ name: "", entity: "", principal: "", balance: "", rate: "", installment: "", paymentDay: "", linkedAccountId: "" });
  const [modalOpen, setModalOpen] = useState(false);
  const [editingDebt, setEditingDebt] = useState(null);
  const [simDebt, setSimDebt] = useState(null);
  const [extra, setExtra] = useState("");

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
            onPay={() => navigate(`/movimientos?nuevo=gasto&deuda=${d.id}&volver=/mi-mes`)}
            onSimulate={() => {
              setSimDebt(d);
              setExtra("");
            }}
          />
        ))}
        {creditCards.map((card) => (
          <Card key={card.id}>
            <div className="flex justify-between gap-3"><div><p className="font-medium">{card.name}</p><p className="text-xs text-ink-soft">Tarjeta administrada desde Cuentas</p></div><span className="font-semibold">{fmtBs(Math.abs(card.balance), currency)}</span></div>
            <Button size="sm" variant="secondary" className="mt-3" onClick={()=>navigate(`/movimientos?nuevo=gasto&tarjeta=${card.id}&volver=/mi-mes`)}>Registrar pago de tarjeta</Button>
            <div className="text-xs text-ink-soft mt-3">Pago mínimo: {card.minimumPayment ? fmtBs(card.minimumPayment, currency) : "falta completar"} · Día de pago: {card.paymentDay || "falta completar"}</div>
          </Card>
        ))}
      </div>

      <details className="text-ink-soft text-xs"><summary className="cursor-pointer font-medium">Cómo se estima el interés</summary><p className="mt-1">El simulador usa una aproximación mensual sobre el saldo; el resultado puede diferir del plan de pagos de tu entidad.</p></details>

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
              <MoneyInput currency={state.profile.currency} type="number" min="0.01" step="0.01" value={form.balance} onChange={(e) => setForm({ ...form, balance: e.target.value })} required />
            </Field>
            <Field label="Tasa anual (%)">
              <Input type="number" min="0" max="300" step="0.01" value={form.rate} onChange={(e) => setForm({ ...form, rate: e.target.value })} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label={`Cuota mensual (${unit})`}>
              <MoneyInput currency={state.profile.currency} type="number" min="0.01" step="0.01" value={form.installment} onChange={(e) => setForm({ ...form, installment: e.target.value })} required />
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
