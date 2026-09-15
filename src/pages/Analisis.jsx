import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useFinanceState } from "../context/FinanceContext.jsx";
import { Button, Card, Modal, ProgressBar } from "../components/ui/primitives.jsx";
import { InsightCard } from "../components/finance/cards.jsx";
import { FinancialHealthSetupForm, ProjectionSetupForm } from "../components/finance/AnalysisSetupForms.jsx";
import { SectionGuide } from "../components/SectionGuide.jsx";
import { calculateFinancialHealth, getCategoryTrends, summarizeByCategory } from "../services/financial/calculations.js";
import { getFinancialDataReadiness } from "../services/financial/readiness.js";
import { generateInsights } from "../services/financial/insights.js";
import { fmtBs, fmtPct } from "../services/financial/format.js";

const HEALTH_LABELS = { flujoCaja: "Flujo de caja", reserva: "Reserva", endeudamiento: "Endeudamiento", planificacion: "Planificación" };

export default function Analisis() {
  const state = useFinanceState();
  const [params, setParams] = useSearchParams();
  const [setup, setSetup] = useState(params.get("config") || null);
  const readiness = getFinancialDataReadiness(state);
  const health = calculateFinancialHealth(state);
  const categories = summarizeByCategory(state);
  const trends = getCategoryTrends(state);
  const insights = generateInsights(state);
  const comparison = readiness.comparison;
  useEffect(() => { const value = params.get("config"); if (value === "health" || value === "projection") setSetup(value); }, [params]);
  function closeSetup() { setSetup(null); if (params.has("config")) { const next = new URLSearchParams(params); next.delete("config"); setParams(next, { replace: true }); } }
  const comparisonData = comparison.available ? [
    { name: "Ingresos", actual: comparison.current.ingresos, anterior: comparison.previous.ingresos },
    { name: "Gastos", actual: comparison.current.gastos, anterior: comparison.previous.gastos },
    { name: "Balance neto", actual: comparison.current.balanceNeto, anterior: comparison.previous.balanceNeto },
  ] : [];
  return <div className="flex flex-col gap-5">
    <h1 className="font-display text-2xl font-semibold">Análisis</h1>
    <div className="grid lg:grid-cols-2 gap-5">
      <Card title="Gastos por categoría">{categories.length ? <div className="flex flex-col sm:flex-row items-center gap-4"><ResponsiveContainer width="55%" height={190}><PieChart><Pie data={categories} dataKey="amount" nameKey="name" innerRadius={45} outerRadius={75}>{categories.map((item) => <Cell key={item.categoryId} fill={item.color} />)}</Pie><Tooltip formatter={(value) => fmtBs(value, state.profile.currency)} /></PieChart></ResponsiveContainer><div className="flex-1 w-full text-xs">{categories.map((item) => <div key={item.categoryId} className="flex justify-between gap-2 py-1"><span>{item.name}</span><span>{fmtBs(item.amount, state.profile.currency)}</span></div>)}</div></div> : <Empty text="Registra un gasto real para ver su distribución." />}</Card>
      <Card title={comparison.label}>{!comparison.available ? <Empty text="Se necesitan ingresos y gastos reales en ambos periodos equivalentes. Los saldos iniciales y ajustes no cuentan." /> : <><p className="text-xs text-ink-soft mb-2">{comparison.current.start} a {comparison.current.end} frente a {comparison.previous.start} a {comparison.previous.end} · {comparison.partial ? "periodos parciales" : "meses cerrados"} · confianza {comparison.confidence}</p><ResponsiveContainer width="100%" height={220}><BarChart data={comparisonData}><XAxis dataKey="name" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 10 }} width={45} /><Tooltip formatter={(value) => fmtBs(value, state.profile.currency)} /><Bar dataKey="anterior" fill="#D3CCB6" name="Periodo anterior" /><Bar dataKey="actual" fill="#1F5C56" name="Periodo actual" /></BarChart></ResponsiveContainer><div className="text-xs text-ink-soft grid grid-cols-2 gap-2">{comparisonData.map((item) => <p key={item.name}>{item.name}: {fmtBs(item.actual, state.profile.currency)} / {fmtBs(item.anterior, state.profile.currency)}</p>)}</div></>}</Card>
    </div>

    <div className="grid lg:grid-cols-2 gap-5">
      <Card title="Salud financiera">{!health.available ? <SetupState title="Puntaje no disponible" text={`Falta: ${health.missing.join(", ")}.`} onClick={() => setSetup("health")} /> : <><div className="flex items-baseline gap-3"><span className="font-display text-4xl font-semibold text-teal">{health.score}%</span><span className="text-xs text-ink-soft">Confianza {health.confidence}</span></div><p className="text-sm text-ink-soft mt-2">{health.resumen}</p><div className="mt-4 flex flex-col gap-4">{Object.entries(health.breakdown).map(([key, item]) => <div key={key}><div className="flex justify-between text-sm"><strong>{HEALTH_LABELS[key]} · peso {Math.round(item.weight * 100)}%</strong><span>{item.score}%</span></div><ProgressBar value={item.score} /><p className="text-xs text-ink-soft mt-1">{item.reason} {item.action}</p></div>)}</div><Button className="mt-4" size="sm" variant="secondary" onClick={() => setSetup("health")}>Editar criterios</Button></>}</Card>
      <div className="flex flex-col gap-5"><ProjectionCard title="Proyección al cierre del mes" projection={readiness.monthEndProjection} state={state} onSetup={() => setSetup("projection")} /><ProjectionCard title="Proyección de los próximos 30 días" projection={readiness.rollingProjection} state={state} onSetup={() => setSetup("projection")} /></div>
    </div>

    <Card title="Tendencias por categoría"><div className="flex flex-col">{trends.length ? trends.map((item) => <div key={item.categoryId} className="grid sm:grid-cols-[1fr_auto] gap-2 py-2 border-b border-dotted border-line last:border-none text-sm"><span>{item.name}</span><span className={item.change == null ? "text-ink-soft" : item.change > 0 ? "text-brick" : "text-teal"}>{item.change == null ? "Base anterior insuficiente" : `${item.change > 0 ? "↑" : "↓"} ${fmtPct(Math.abs(item.change))}`} · {fmtBs(item.previous, state.profile.currency)} → {fmtBs(item.current, state.profile.currency)}</span></div>) : <Empty text="Aún no hay dos periodos equivalentes con muestras suficientes." />}</div></Card>
    <Card title="Insights">{insights.length ? <div className="flex flex-col gap-4">{insights.map((item) => <InsightCard key={item.id} insight={item} />)}</div> : <Empty text="Registra movimientos reales para recibir observaciones basadas en tus datos." />}</Card>
    <SectionGuide section="analysis" autoOpen={!setup} />
    <Modal open={setup === "health"} onClose={closeSetup} title="Configurar salud financiera"><FinancialHealthSetupForm onSuccess={closeSetup} /></Modal>
    <Modal open={setup === "projection"} onClose={closeSetup} title="Configurar proyección"><ProjectionSetupForm onSuccess={closeSetup} /></Modal>
  </div>;
}

function ProjectionCard({ title, projection, state, onSetup }) {
  if (!projection.available) return <Card title={title}><SetupState title="Proyección no disponible" text={`Falta: ${projection.missing.join(", ")}.`} onClick={onSetup} /></Card>;
  return <Card title={title}><p className="text-xs text-ink-soft">{projection.startDate} a {projection.endDate} · {projection.days} {projection.days === 1 ? "día" : "días"} · confianza {projection.confidence}</p><div className="mt-3 text-sm"><ValueRow label="Saldo inicial" value={projection.formula.initialBalance} state={state} /><ValueRow label="+ Ingresos esperados" value={projection.formula.expectedIncome} state={state} /><ValueRow label="− Recurrentes, deuda y metas" value={-projection.formula.recurringAndDebtCommitments} state={state} /><ValueRow label="− Gastos variables" value={-projection.formula.variableExpenses} state={state} /><ValueRow label="Saldo proyectado" value={projection.end} state={state} strong /></div>{projection.confidenceIssues.length ? <p className="text-xs text-ochre mt-3">Baja confianza: falta {projection.confidenceIssues.join(", ")}.</p> : null}<details className="mt-3 text-xs"><summary className="cursor-pointer font-medium">Ver eventos del cálculo</summary><div className="mt-2 flex flex-col gap-1">{projection.timeline.map((event) => <div key={event.id} className="flex justify-between gap-2"><span>{event.date.toLocaleDateString("es-BO")} · {event.name}</span><span>{fmtBs(event.delta, state.profile.currency)}</span></div>)}</div></details><Button className="mt-3" size="sm" variant="secondary" onClick={onSetup}>Editar supuestos</Button></Card>;
}
function ValueRow({ label, value, state, strong }) { return <div className={`flex justify-between leader-dotted py-1 ${strong ? "font-semibold border-t border-line mt-1 pt-2" : ""}`}><span>{label}</span><span>{fmtBs(value, state.profile.currency)}</span></div>; }
function SetupState({ title, text, onClick }) { return <div className="py-3"><p className="font-medium">{title}</p><p className="text-sm text-ink-soft mt-2">{text}</p><Button className="mt-4" size="sm" onClick={onClick}>Completar datos</Button></div>; }
function Empty({ text }) { return <p className="text-ink-soft text-sm py-4">{text}</p>; }
