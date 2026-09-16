import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useFinanceState } from "../context/FinanceContext.jsx";
import { Button, Card, ProgressBar } from "../components/ui/primitives.jsx";
import { InsightCard } from "../components/finance/cards.jsx";
import { MonthlyPlanPanel } from "../components/finance/MonthlyPlanPanel.jsx";
import { Deudas, FondoEmergencia } from "./Planes.jsx";
import { monthKey, monthlyHealth, expenseClassification } from "../services/financial/monthlyPlan.js";
import { SectionGuide } from "../components/SectionGuide.jsx";
import { getCategoryTrends, summarizeByCategory } from "../services/financial/calculations.js";
import { getFinancialDataReadiness } from "../services/financial/readiness.js";
import { generateInsights } from "../services/financial/insights.js";
import { fmtBs, fmtPct } from "../services/financial/format.js";

const HEALTH_LABELS = { flujoCaja: "Control del mes", reserva: "Dinero para imprevistos", endeudamiento: "Cuotas y compromisos", planificacion: "Objetivos y margen" };

export default function Analisis() {
  const state = useFinanceState();
  const [params, setParams] = useSearchParams();
  const [setup, setSetup] = useState(params.get("config") || null);
  const [month,setMonth] = useState(monthKey());
  const [year,selectedMonth]=month.split("-").map(Number);
  const reference=month === monthKey() ? new Date() : new Date(year,selectedMonth,0);
  const readiness = getFinancialDataReadiness(state,reference);
  const health = state.monthlyPlans.some(plan=>plan.month === month) ? monthlyHealth(state,month) : {available:false,missing:["el Plan del mes"]};
  const categories = summarizeByCategory(state,"current",reference);
  const trends = getCategoryTrends(state,reference);
  const insights = generateInsights(state, reference);
  const comparison = readiness.comparison;
  const classified=expenseClassification(state,month);
  useEffect(() => { const value = params.get("config"); if (value === "health" || value === "projection") setSetup(value); }, [params]);
  function closeSetup() { setSetup(null); if (params.has("config")) { const next = new URLSearchParams(params); next.delete("config"); setParams(next, { replace: true }); } }
  const comparisonData = comparison.available ? [
    { name: "Ingresos", actual: comparison.current.ingresos, anterior: comparison.previous.ingresos },
    { name: "Gastos", actual: comparison.current.gastos, anterior: comparison.previous.gastos },
    { name: "Balance neto", actual: comparison.current.balanceNeto, anterior: comparison.previous.balanceNeto },
  ] : [];
  return <div className="flex flex-col gap-5">
    <h1 className="font-display text-2xl font-semibold">Mi mes</h1>
    <MonthlyPlanPanel month={month} onMonth={setMonth} requestEdit={Boolean(setup)} onEditClosed={closeSetup} />
    <Card title="Gastos fijos frente a variables · registrados"><div className="grid sm:grid-cols-3 gap-3 text-sm"><p>Fijos: <strong>{fmtBs(classified.fijo,state.profile.currency)}</strong></p><p>Variables: <strong>{fmtBs(classified.variable,state.profile.currency)}</strong></p>{classified.sinClasificar>0 ? <p>Sin clasificación: {fmtBs(classified.sinClasificar,state.profile.currency)}</p> : null}</div><p className="text-xs text-ink-soft mt-2">La clasificación es la guardada al registrar cada movimiento; incluye gastos no previstos en el plan.</p></Card>
    <div className="grid lg:grid-cols-2 gap-5">
      <Card title="Gastos por categoría">{categories.length ? <div className="flex flex-col sm:flex-row items-center gap-4"><ResponsiveContainer width="55%" height={190}><PieChart><Pie data={categories} dataKey="amount" nameKey="name" innerRadius={45} outerRadius={75}>{categories.map((item) => <Cell key={item.categoryId} fill={item.color} />)}</Pie><Tooltip formatter={(value) => fmtBs(value, state.profile.currency)} /></PieChart></ResponsiveContainer><div className="flex-1 w-full text-xs">{categories.map((item) => <div key={item.categoryId} className="flex justify-between gap-2 py-1"><span>{item.name}</span><span>{fmtBs(item.amount, state.profile.currency)}</span></div>)}</div></div> : <Empty text="Registra un gasto real para ver su distribución." />}</Card>
      <Card title={comparison.label}>{!comparison.available ? <Empty text="Se necesitan ingresos y gastos reales en ambos periodos equivalentes. Los saldos iniciales y ajustes no cuentan." /> : <><p className="text-xs text-ink-soft mb-2">{comparison.current.start} a {comparison.current.end} frente a {comparison.previous.start} a {comparison.previous.end} · {comparison.partial ? "periodos parciales" : "meses cerrados"} · confianza {comparison.confidence}</p><ResponsiveContainer width="100%" height={220}><BarChart data={comparisonData}><XAxis dataKey="name" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 10 }} width={45} /><Tooltip formatter={(value) => fmtBs(value, state.profile.currency)} /><Bar dataKey="anterior" fill="#D3CCB6" name="Periodo anterior" /><Bar dataKey="actual" fill="#1F5C56" name="Periodo actual" /></BarChart></ResponsiveContainer><div className="text-xs text-ink-soft grid grid-cols-2 gap-2">{comparisonData.map((item) => <p key={item.name}>{item.name}: {fmtBs(item.actual, state.profile.currency)} / {fmtBs(item.anterior, state.profile.currency)}</p>)}</div></>}</Card>
    </div>

    <div className="grid lg:grid-cols-2 gap-5">
      <Card title="Salud financiera">{!health.available ? <SetupState title="Puntaje no disponible" text={`Falta: ${health.missing.join(", ")}.`} onClick={() => setSetup("health")} /> : <><div className="flex items-baseline gap-3"><span className="font-display text-4xl font-semibold text-teal">{health.scoreDisplayable ? `${health.score}%` : "Sin puntaje global"}</span><span className="text-xs text-ink-soft">{health.partial ? "Puntaje parcial · " : "Puntaje aproximado · "}Confianza {health.confidence}</span></div><p className="text-sm text-ink-soft mt-2">{health.resumen}</p><div className="mt-4 flex flex-col gap-4">{Object.entries(health.breakdown).map(([key, item]) => <div key={key}><div className="flex justify-between text-sm"><strong>{HEALTH_LABELS[key]} · peso {Math.round(item.weight * 100)}%</strong><span>{item.score === null ? "No informado" : `${item.score}%`}</span></div>{item.score !== null ? <ProgressBar value={item.score} /> : null}<p className="text-xs text-ink-soft mt-1">{item.reason} {item.action}</p></div>)}</div><Button className="mt-4" size="sm" variant="secondary" onClick={() => setSetup("health")}>Editar criterios</Button></>}</Card>
      <Card title="Estimaciones y hechos"><p className="text-sm text-ink-soft">El Plan del mes contiene estimaciones del mes completo. Los gráficos y comparaciones muestran exclusivamente movimientos operativos registrados. Registra cada ingreso, gasto, transferencia o aporte en Movimientos.</p><p className="text-xs mt-3">Un objetivo menor no mejora el puntaje. Los componentes desconocidos se presentan sin puntaje; el total se calcula solo sobre componentes conocidos.</p></Card>
    </div>

    <Card title="Tendencias por categoría"><div className="flex flex-col">{trends.length ? trends.map((item) => <div key={item.categoryId} className="grid sm:grid-cols-[1fr_auto] gap-2 py-2 border-b border-dotted border-line last:border-none text-sm"><span>{item.name}</span><span className={item.change == null ? "text-ink-soft" : item.change > 0 ? "text-brick" : "text-teal"}>{item.change == null ? "Base anterior insuficiente" : `${item.change > 0 ? "↑" : "↓"} ${fmtPct(Math.abs(item.change))}`} · {fmtBs(item.previous, state.profile.currency)} → {fmtBs(item.current, state.profile.currency)}</span></div>) : <Empty text="Aún no hay dos periodos equivalentes con muestras suficientes." />}</div></Card>
    <Card title="Insights">{insights.length ? <div className="flex flex-col gap-4">{insights.map((item) => <InsightCard key={item.id} insight={item} />)}</div> : <Empty text="Registra movimientos reales para recibir observaciones basadas en tus datos." />}</Card>
    <Card title="Cuotas y tarjetas"><details><summary className="cursor-pointer text-sm">Ver y administrar mis deudas</summary><div className="mt-4"><Deudas /></div></details></Card>
    <Card title="Ahorros para imprevistos"><details><summary className="cursor-pointer text-sm">Ver reserva y referencia de meses</summary><div className="mt-4"><FondoEmergencia /></div></details></Card>
    <SectionGuide section="analysis" autoOpen={!setup} />
  </div>;
}

function SetupState({ title, text, onClick }) { return <div className="py-3"><p className="font-medium">{title}</p><p className="text-sm text-ink-soft mt-2">{text}</p><Button className="mt-4" size="sm" onClick={onClick}>Completar datos</Button></div>; }
function Empty({ text }) { return <p className="text-ink-soft text-sm py-4">{text}</p>; }
