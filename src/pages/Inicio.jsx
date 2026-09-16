import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeftRight, ArrowRight, BarChart3, Bot, Check, Circle, ShoppingBag, Target, WalletCards } from "lucide-react";
import { useFinanceState } from "../context/FinanceContext.jsx";
import { Button, Card, ProgressBar } from "../components/ui/primitives.jsx";
import { FinancialScoreGauge } from "../components/finance/FinancialScoreGauge.jsx";
import { InsightCard } from "../components/finance/cards.jsx";
import { SectionGuide } from "../components/SectionGuide.jsx";
import { calculateAvailableMoney, getSavingsRealized, getUpcomingCommitments, hasFinancialData } from "../services/financial/calculations.js";
import { getFinancialDataReadiness } from "../services/financial/readiness.js";
import { getMainInsight } from "../services/financial/insights.js";
import { fmtBs, fmtFecha, fmtPct } from "../services/financial/format.js";
import { monthlyPlanStatus, monthlyHealth } from "../services/financial/monthlyPlan.js";

const BREAKDOWN_LABELS = { flujoCaja: "Control del mes", reserva: "Dinero para imprevistos", endeudamiento: "Cuotas y compromisos", planificacion: "Objetivos y margen" };
const plural = (count, singular, multiple) => `${count} ${count === 1 ? singular : multiple}`;

export default function Inicio() {
  const state = useFinanceState();
  const navigate = useNavigate();
  const readiness = getFinancialDataReadiness(state);
  const hasAccounts = state.accounts.some((account) => account.type !== "tarjeta_credito");
  return <div className="flex flex-col gap-6">
    <div><h1 className="font-display text-2xl font-semibold">Hola, {state.profile.name}</h1><p className="text-ink-soft text-sm mt-0.5">Este es tu espacio para entender y mejorar tus finanzas.</p></div>
    {!hasAccounts ? <Card><p className="font-display text-lg font-semibold">Añade dónde guardas tu dinero</p><p className="text-ink-soft text-sm mt-2">Necesitas al menos una cuenta de activo para calcular saldos y proyecciones.</p><Button className="mt-4" onClick={() => navigate("/cuentas")}>Añadir cuenta</Button></Card> : null}
    {hasAccounts && !readiness.firstMovements.complete ? <FirstMovementsCard progress={readiness.firstMovements} navigate={navigate} /> : null}
    {hasAccounts ? <MonthlyHomeSummary state={state} /> : null}
    {hasAccounts ? <HomeSavingsOverview state={state} /> : null}
    <div className="grid sm:grid-cols-2 gap-4">
      <HighlightedAccess icon={ShoppingBag} title="¿Puedo comprarlo?" text="Evalúa una compra con tus compromisos, reserva y objetivos." onClick={() => navigate("/puedo-comprarlo")} />
      <HighlightedAccess icon={Bot} title="Preguntar al Copiloto" text="Consulta tus finanzas y recibe respuestas con cifras." onClick={() => navigate("/copiloto")} />
    </div>
    {hasFinancialData(state) ? <FinancialSummary state={state} navigate={navigate} readiness={readiness} /> : null}
    <WhatYouCanDo state={state} navigate={navigate} />
    <SectionGuide section="home" />
  </div>;
}

function FirstMovementsCard({ progress, navigate }) {
  const completed = Number(progress.hasIncome) + Number(progress.hasExpense);
  return <Card className="border-teal/40 bg-teal/[0.04]"><div className="grid lg:grid-cols-[1fr_auto] gap-5 items-center"><div>
    <p className="font-display text-xl font-semibold">Completa tus primeros movimientos</p>
    <p className="text-sm text-ink-soft mt-1">Registrar ingresos y gastos reales permitirá calcular análisis, proyecciones e insights fiables.</p>
    <div className="mt-4 max-w-md"><ProgressBar value={(completed / 2) * 100} /></div>
    <div className="mt-3 grid sm:grid-cols-2 gap-2 text-sm"><ProgressItem done={progress.hasIncome}>Registrar primer ingreso real</ProgressItem><ProgressItem done={progress.hasExpense}>Registrar primer gasto real</ProgressItem></div>
  </div><div className="flex flex-wrap lg:flex-col gap-2">
    {!progress.hasIncome ? <Button onClick={() => navigate("/movimientos?nuevo=ingreso")}>Registrar ingreso</Button> : null}
    {!progress.hasExpense ? <Button onClick={() => navigate("/movimientos?nuevo=gasto")} variant={progress.hasIncome ? "primary" : "secondary"}>Registrar gasto</Button> : null}
  </div></div></Card>;
}

function ProgressItem({ done, children }) { const Icon = done ? Check : Circle; return <span className={`flex items-center gap-2 ${done ? "text-teal" : "font-medium"}`}><Icon size={15} aria-hidden="true" />{children}</span>; }

function HighlightedAccess({ icon: Icon, title, text, onClick }) { return <button onClick={onClick} className="text-left border border-line rounded p-5 bg-paper hover:bg-paper-raised transition-colors flex items-start gap-4"><span className="w-10 h-10 rounded-full bg-teal/10 flex items-center justify-center shrink-0"><Icon size={18} className="text-teal" aria-hidden="true" /></span><span><span className="font-display font-semibold block">{title}</span><span className="text-ink-soft text-sm mt-0.5 block">{text}</span></span></button>; }

function FinancialSummary({ state, navigate, readiness }) {
  const health = monthlyHealth(state);
  const { totalBalance, committed, available } = calculateAvailableMoney(state);
  const month = readiness.latestMonth;
  const comparison = readiness.comparison?.available ? readiness.comparison : null;
  const savingsRealized = getSavingsRealized(state);
  const status=monthlyPlanStatus(state);
  const commitments = status.plan ? [...status.expenses.filter(item=>item.classification === "fijo" && item.pending>0).map(item=>({...item,amount:item.pending,date:status.endDate})), ...status.overdue.map(item=>({...item,amount:item.pending,date:status.startDate})), ...(status.debtPending>0 ? [{id:"external-debt",name:"Cuotas y tarjetas fuera de los fijos",amount:status.debtPending,date:status.endDate}] : [])].slice(0,4) : getUpcomingCommitments(state,30).slice(0,4);
  const projection = status;
  return <div className="flex flex-col gap-5">
    <div className="grid md:grid-cols-2 gap-5">
      <Card title="Salud financiera">{!health.available ? <MissingState title="Salud financiera aún no disponible" text={`Falta: ${health.missing.join(", ")}.`} onClick={() => navigate("/mi-mes?config=health")} /> : <>{health.scoreDisplayable ? <FinancialScoreGauge score={health.score} /> : <p className="font-semibold">Evaluación orientativa: todavía faltan datos suficientes para un puntaje global.</p>}<p className="text-sm text-ink-soft mt-3">{health.resumen} Confianza {health.confidence}.</p><div className="mt-4 flex flex-col gap-2">{Object.entries(health.breakdown).map(([key, item]) => <div key={key}><div className="flex justify-between text-xs mb-1"><span>{BREAKDOWN_LABELS[key]} · {Math.round(item.weight * 100)}%</span><span>{item.score === null ? "No informado" : `${item.score}%`}</span></div>{item.score !== null ? <ProgressBar value={item.score} /> : null}</div>)}</div><Link to="/mi-mes" className="text-ochre text-xs underline mt-3 inline-block">Ver criterios y acciones</Link></>}</Card>
      <Card title="Dinero disponible"><div className="font-display text-3xl font-semibold text-teal">{fmtBs(available, state.profile.currency)}</div><p className="text-ink-soft text-xs mt-1">Excluye cuentas de ahorro, dinero protegido y compromisos pendientes.</p><div className="mt-4 flex flex-col gap-2 text-sm"><MoneyRow label="Saldo total de activos" value={totalBalance} currency={state.profile.currency} /><MoneyRow label="Cuentas de ahorro" value={-status.cash.savings} currency={state.profile.currency} /><MoneyRow label="Protegido en otras cuentas" value={-status.cash.protectedMoney} currency={state.profile.currency} /><MoneyRow label="Comprometido" value={-committed} currency={state.profile.currency} /><MoneyRow label="Disponible" value={available} currency={state.profile.currency} strong /></div><Button className="mt-4" size="sm" variant="secondary" onClick={() => navigate("/cuentas")}>Ver y editar cuentas</Button></Card>
      <Card title="Resumen mensual"><div className="flex flex-col gap-2 text-sm"><MoneyRow label="Ingresos del mes" value={month.ingresos} currency={state.profile.currency} /><MoneyRow label="Gastos del mes" value={-month.gastos} currency={state.profile.currency} /><MoneyRow label="Balance neto del mes" value={month.balanceNeto} currency={state.profile.currency} strong /><MoneyRow label="Ahorro realizado" value={savingsRealized} currency={state.profile.currency} /></div>{comparison ? <p className="text-xs text-ink-soft mt-3">Comparación equivalente: {comparison.current.start} a {comparison.current.end} frente a {comparison.previous.start} a {comparison.previous.end}.</p> : <p className="text-xs text-ink-soft mt-3">La comparación aparecerá cuando ambos periodos tengan ingresos y gastos reales.</p>}</Card>
      <Card title="Proyección al cierre del mes">{!projection.available ? <MissingState title="Proyección aún no disponible" text={`Falta: ${projection.missing.join(", ")}.`} onClick={() => navigate("/mi-mes?config=projection")} /> : <><div className="font-display text-3xl font-semibold">{fmtBs(projection.end, state.profile.currency)}</div><p className="text-ink-soft text-sm mt-1">Del {projection.startDate} al {projection.endDate} · {plural(projection.days, "día", "días")} · confianza {projection.confidence}.</p><Link to="/mi-mes" className="text-ochre text-xs underline mt-2 inline-block">Ver fórmula del Plan del mes</Link></>}</Card>
    </div>
    <Card title="Próximos compromisos"><div className="flex flex-col">{commitments.map((item) => <div key={`${item.id}-${item.date}`} className="grid grid-cols-[1fr_auto_auto] gap-3 py-2 border-b border-dotted border-line last:border-none text-sm"><span>{item.name}</span><span className="text-ink-soft">{fmtFecha(item.date)}</span><span className="tabular-nums">− {fmtBs(item.amount, state.profile.currency)}</span></div>)}{commitments.length === 0 ? <p className="text-ink-soft text-sm">No hay compromisos próximos registrados. Añádelos en Mi mes.</p> : null}</div></Card>
    <Card title="Tu principal insight"><InsightCard insight={getMainInsight(state)} /><Link to="/mi-mes" className="text-ochre text-xs underline mt-3 inline-block">Ver Mi mes</Link></Card>
  </div>;
}

function MonthlyHomeSummary({state}) {
  const status=monthlyPlanStatus(state);const fmt=value=>fmtBs(value,state.profile.currency);
  if(!status.plan) return <Card title="Prepara tu Plan del mes"><p className="text-sm text-ink-soft">Estima lo que recibirás y gastarás durante todo el mes para saber con cuánto podrías terminar.</p><Link to="/mi-mes?config=projection" className="underline text-sm mt-3 inline-block">Crear Plan del mes</Link></Card>;
  return <Card title="Tu mes, de un vistazo"><div className="grid sm:grid-cols-2 gap-4"><div><p className="text-xs text-ink-soft">Disponible estimado al cierre</p><strong className="text-2xl">{fmt(status.closing)}</strong><p className="text-xs mt-1">Objetivo {fmt(status.target)} · {status.targetDifference>=0 ? "por encima" : "por debajo"} en {fmt(Math.abs(status.targetDifference))} · confianza {status.confidence}</p></div><div className="text-xs"><p>Dinero total: {fmt(status.cash.total)}</p><p>En cuentas de ahorro: {fmt(status.cash.savings)}</p><p>Protegido en otras cuentas: {fmt(status.cash.protectedMoney)}</p><p>Compromisos fijos y cuotas pendientes: {fmt(status.fixedPending+status.debtPending+status.overduePending)}</p><p>Aportes pendientes: {fmt(status.savingsPending)}</p></div></div>{status.alerts.map(item=><p key={item.id} className="text-sm text-brick mt-3">{item.categorySnapshot.name}: {fmt(item.actual)} de {fmt(item.estimated)} · {item.alert === "superado" ? "límite superado" : item.alert === "alcanzado" ? "límite alcanzado" : "cerca del límite"}</p>)}<div className="flex flex-wrap gap-4 mt-4"><Link className="underline text-sm" to="/mi-mes">Revisar mi mes</Link><Link className="underline text-sm" to="/planes-ahorro">Decidir un aporte con dinero disponible</Link></div><p className="text-xs text-ink-soft mt-3">Un saldo positivo al cierre no se asigna automáticamente: conserva el dinero, protégelo en un plan o transfiérelo a ahorro desde Movimientos.</p></Card>;
}

function HomeSavingsOverview({state}) {
  const fmt=value=>fmtBs(value,state.profile.currency);
  return <Card title="Ahorros y avance de tus planes"><p className="text-sm">Cuentas de ahorro: {fmt(monthlyPlanStatus(state).cash.savings)} · Aportes protegidos en cuentas de uso diario: {fmt(monthlyPlanStatus(state).cash.protectedMoney)}.</p><div className="grid sm:grid-cols-2 gap-4 mt-4">{state.goals.map(goal=><div key={goal.id}><div className="flex justify-between text-sm"><span>{goal.name}</span><span>{fmt(goal.current)} de {fmt(goal.target)}</span></div><ProgressBar value={goal.target>0 ? goal.current/goal.target*100 : 0} /></div>)}</div><Link to="/planes-ahorro" className="text-sm underline mt-3 inline-block">Administrar planes y aportes</Link></Card>;
}

function MissingState({ title, text, onClick }) { return <div className="py-4"><p className="font-medium">{title}</p><p className="text-sm text-ink-soft mt-2">{text}</p><Button className="mt-4" size="sm" onClick={onClick}>Completar datos</Button></div>; }
function MoneyRow({ label, value, currency, strong }) { return <div className={`flex justify-between leader-dotted pb-1.5 ${strong ? "font-semibold" : ""}`}><span className={strong ? "" : "text-ink-soft"}>{label}</span><span className="tabular-nums">{fmtBs(value, currency)}</span></div>; }

function WhatYouCanDo({ state, navigate }) {
  const goals = state.goals.length;
  const movements = state.transactions.length;
  const items = [
    { icon: WalletCards, title: "Cuentas", text: "Consulta saldos y registra ajustes trazables.", sub: plural(state.accounts.length, "cuenta", "cuentas"), to: "/cuentas" },
    { icon: ArrowLeftRight, title: "Movimientos", text: "Registra y organiza ingresos y gastos.", sub: plural(movements, "movimiento registrado", "movimientos registrados"), to: "/movimientos" },
    { icon: Target, title: "Planes de Ahorro", text: "Separa dinero real y sigue el avance de tus objetivos.", sub: goals ? plural(goals, "objetivo", "objetivos") : "Configura tu primer objetivo", to: "/planes-ahorro" },
    { icon: BarChart3, title: "Mi mes", text: "Revisa salud, periodos equivalentes y proyecciones.", sub: "Cálculos y supuestos explicados", to: "/mi-mes" },
    { icon: Bot, title: "Copiloto", text: "Haz preguntas concretas sobre tus finanzas.", sub: "Respuestas basadas en tus datos", to: "/copiloto" },
    { icon: ShoppingBag, title: "¿Puedo comprarlo?", text: "Mide el impacto antes de gastar.", sub: "Liquidez, reserva y compromisos", to: "/puedo-comprarlo" },
  ];
  return <div><h2 className="font-display font-semibold text-lg mb-3">¿Qué puedes hacer?</h2><div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">{items.map((item) => <button key={item.to} onClick={() => navigate(item.to)} className="text-left border border-line rounded p-4 bg-paper hover:bg-paper-raised transition-colors flex flex-col gap-2"><span className="flex items-center gap-2"><item.icon size={16} className="text-teal" aria-hidden="true" /><span className="font-medium text-sm">{item.title}</span></span><span className="text-ink-soft text-xs">{item.text}</span><span className="flex items-center justify-between mt-1"><span className="text-xs text-ink-soft">{item.sub}</span><ArrowRight size={13} aria-hidden="true" /></span></button>)}</div></div>;
}
