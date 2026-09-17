import React, { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
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
import { actualMonth, actualFinancialHealth } from "../services/financial/actualMonth.js";

const HEALTH_LABELS = { flujoCaja: "Control del mes", reserva: "Dinero para imprevistos", endeudamiento: "Cuotas y compromisos", planificacion: "Objetivos y margen" };

export default function Analisis() {
  const state = useFinanceState();
  const [params, setParams] = useSearchParams();
  const [setup, setSetup] = useState(params.get("config") || null);
  const [month,setMonth] = useState(monthKey());
  const [tab,setTab] = useState(params.has("config") ? "plan" : "real");
  const facts = actualMonth(state,month);
  const [year,selectedMonth]=month.split("-").map(Number);
  const reference=month === monthKey() ? new Date() : new Date(year,selectedMonth,0);
  const actualState = {...state,transactions:state.transactions.filter(tx=>tx.date <= facts.today)};
  const readiness = getFinancialDataReadiness(actualState,reference);
  const health = actualFinancialHealth(state,month);
  const categories = summarizeByCategory(state,"current",reference);
  const trends = getCategoryTrends(actualState,reference);
  const insights = generateInsights({...actualState,monthlyPlans:[]}, reference);
  const comparison = readiness.comparison;
  const classified=facts.classification;
  useEffect(() => { const value = params.get("config"); if (value === "health" || value === "projection") setSetup(value); }, [params]);
  function closeSetup() { setSetup(null); if (params.has("config")) { const next = new URLSearchParams(params); next.delete("config"); setParams(next, { replace: true }); } }
  const comparisonData = comparison.available ? [
    { name: "Ingresos", actual: comparison.current.ingresos, anterior: comparison.previous.ingresos },
    { name: "Gastos", actual: comparison.current.gastos, anterior: comparison.previous.gastos },
    { name: "Balance neto", actual: comparison.current.balanceNeto, anterior: comparison.previous.balanceNeto },
  ] : [];
  return <div className="flex flex-col gap-5">
    <h1 className="font-display text-2xl font-semibold">Mi mes</h1>
    <div role="tablist" aria-label="Hechos y planificación" className="flex gap-2"><Button role="tab" aria-selected={tab === "real"} variant={tab === "real" ? "primary" : "secondary"} onClick={()=>setTab("real")}>Mi mes</Button><Button role="tab" aria-selected={tab === "plan"} variant={tab === "plan" ? "primary" : "secondary"} onClick={()=>setTab("plan")}>Plan del mes</Button></div>
    <p className="text-sm text-ink-soft">{tab === "real" ? "Tu dinero y tus movimientos registrados" : "Planifica el mes y revisa cómo vas"}</p>
    {tab === "plan" ? <MonthlyPlanPanel month={month} onMonth={setMonth} requestEdit={Boolean(setup)} onEditClosed={closeSetup} /> : <>
    <Card title={`Saldos actuales al ${facts.today}`}><div className="grid sm:grid-cols-3 gap-4">{[["Dinero total",facts.cash.total],["Ahorros actuales",facts.cash.savings+facts.cash.protectedMoney],["Disponible para gastar",facts.cash.spendable]].map(([label,value])=><div key={label}><p className="text-sm">{label}</p><strong>{fmtBs(value,state.profile.currency)}</strong></div>)}</div><p className="text-xs mt-3 text-ink-soft">Los saldos son actuales, incluso al consultar meses anteriores. El disponible excluye ahorros y dinero protegido, sin sumar ingresos esperados.</p>{facts.accounts.filter(account=>account.type !== "tarjeta_credito").map(account=><p key={account.id} className="text-sm mt-2">{account.name}: {fmtBs(account.balance,state.profile.currency)}</p>)}<a href="/cuentas" className="underline text-sm">Ver cuentas</a></Card>
    <Card title={`Movimientos de ${month}`}><label className="text-sm">Mes que quieres consultar <input className="border border-line rounded p-2" type="month" value={month} max={facts.today.slice(0,7)} onChange={event=>event.target.value && setMonth(event.target.value)} /></label><div className="grid sm:grid-cols-3 gap-4 mt-3">{[["Ingresos registrados",facts.income],["Gastos registrados",facts.expense],["Balance neto del mes",facts.result]].map(([label,value])=><p key={label}>{label}: <strong>{fmtBs(value,state.profile.currency)}</strong></p>)}</div><p className="text-xs mt-2">Basado en tus movimientos registrados. El balance neto no equivale a ahorro realizado.</p>{facts.futureCount ? <p role="status" className="text-sm text-ochre mt-2">Hay {facts.futureCount} registros antiguos con fecha futura; se conservan y se excluyen de los hechos hasta su fecha.</p> : null}</Card>
    <Card title="Ingresos y gastos por semana">{facts.transactions.length ? <><ResponsiveContainer width="100%" height={230}><BarChart data={facts.weeks}><XAxis dataKey="name" /><YAxis /><Tooltip formatter={value=>fmtBs(value,state.profile.currency)} /><Bar dataKey="income" name="Ingresos" fill="#1F5C56" /><Bar dataKey="expense" name="Gastos" fill="#A44A39" /></BarChart></ResponsiveContainer><p className="text-xs">Días de {month}, incluyendo semanas parciales.</p></> : <Empty text="Registra ingresos y gastos reales para ver este gráfico." />}</Card>
    <Card title="Gastos fijos frente a variables · registrados">{facts.expense>0 ? <div className="flex h-5 rounded overflow-hidden mb-3" aria-label="Distribución de gastos">{Object.entries(classified).map(([key,value],index)=><div key={key} style={{width:`${value/facts.expense*100}%`,background:["#1F5C56","#B88C45","#D3CCB6"][index]}} />)}</div> : null}<div className="grid sm:grid-cols-3 gap-3 text-sm"><p>Fijos: <strong>{fmtBs(classified.fijo,state.profile.currency)}</strong> · {facts.expense>0 ? Math.round(classified.fijo/facts.expense*100) : 0}%</p><p>Variables: <strong>{fmtBs(classified.variable,state.profile.currency)}</strong> · {facts.expense>0 ? Math.round(classified.variable/facts.expense*100) : 0}%</p>{classified.sinClasificar>0 ? <p>Sin clasificación: {fmtBs(classified.sinClasificar,state.profile.currency)}</p> : null}</div><p className="text-xs text-ink-soft mt-2">La clasificación es la guardada al registrar cada movimiento; incluye gastos no previstos en el plan.</p></Card>
    <div className="grid lg:grid-cols-2 gap-5">
      <Card title="Gastos por categoría">{facts.categories.length ? <><ResponsiveContainer width="100%" height={Math.max(180,Math.min(6,facts.categories.length)*45)}><BarChart layout="vertical" data={facts.categories.slice(0,6)}><XAxis type="number" /><YAxis type="category" dataKey="name" width={110} tick={{fontSize:11}} /><Tooltip formatter={value=>fmtBs(value,state.profile.currency)} /><Bar dataKey="amount" name="Gastos" fill="#1F5C56" /></BarChart></ResponsiveContainer><details><summary className="text-sm cursor-pointer">Ver todas las categorías</summary>{facts.categories.map(item=><p key={item.id} className="text-sm py-1">{item.name}: {fmtBs(item.amount,state.profile.currency)} · {Math.round(item.percent)}%</p>)}</details></> : <Empty text="Registra un gasto real para ver su distribución." />}</Card>
      <Card title={comparison.label}>{!comparison.available ? <Empty text="Se necesitan ingresos y gastos reales en ambos periodos equivalentes. Los saldos iniciales y ajustes no cuentan." /> : <><p className="text-xs text-ink-soft mb-2">{comparison.current.start} a {comparison.current.end} frente a {comparison.previous.start} a {comparison.previous.end} · {comparison.partial ? "periodos parciales" : "meses cerrados"} · confianza {comparison.confidence}</p><ResponsiveContainer width="100%" height={220}><BarChart data={comparisonData}><XAxis dataKey="name" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 10 }} width={45} /><Tooltip formatter={(value) => fmtBs(value, state.profile.currency)} /><Bar dataKey="anterior" fill="#D3CCB6" name="Periodo anterior" /><Bar dataKey="actual" fill="#1F5C56" name="Periodo actual" /></BarChart></ResponsiveContainer><div className="text-xs text-ink-soft grid grid-cols-2 gap-2">{comparisonData.map((item) => <p key={item.name}>{item.name}: {fmtBs(item.actual, state.profile.currency)} / {fmtBs(item.anterior, state.profile.currency)}</p>)}</div></>}</Card>
    </div>

    <div className="grid lg:grid-cols-2 gap-5">
      <Card title="Salud financiera">{!health.available ? <SetupState title="Puntaje no disponible" text={`Falta: ${health.missing.join(", ")}.`} onClick={() => {setTab("plan");setSetup("health");}} /> : <><div className="flex items-baseline gap-3"><span className="font-display text-4xl font-semibold text-teal">{health.scoreDisplayable ? `${health.score}%` : "Sin puntaje global"}</span><span className="text-xs text-ink-soft">{health.partial ? "Puntaje parcial · " : "Puntaje aproximado · "}Confianza {health.confidence}</span></div><p className="text-sm text-ink-soft mt-2">{health.resumen}</p><div className="mt-4 flex flex-col gap-4">{Object.entries(health.breakdown).map(([key, item]) => <div key={key}><div className="flex justify-between text-sm"><strong>{HEALTH_LABELS[key]} · peso {Math.round(item.weight * 100)}%</strong><span>{item.score === null ? "No informado" : `${item.score}%`}</span></div>{item.score !== null ? <ProgressBar value={item.score} /> : null}<p className="text-xs text-ink-soft mt-1">{item.reason} {item.action}</p></div>)}</div><Link className="inline-block underline text-sm mt-4" to="/movimientos">Completar mis registros</Link></>}</Card>
      <Card title="Estimaciones y hechos"><p className="text-sm text-ink-soft">El Plan del mes contiene estimaciones del mes completo. Los gráficos y comparaciones muestran exclusivamente movimientos operativos registrados. Registra cada ingreso, gasto, transferencia o aporte en Movimientos.</p><p className="text-xs mt-3">Un objetivo menor no mejora el puntaje. Los componentes desconocidos se presentan sin puntaje; el total se calcula solo sobre componentes conocidos.</p></Card>
    </div>

    <Card title="Tendencias por categoría"><div className="flex flex-col">{trends.length ? trends.map((item) => <div key={item.categoryId} className="grid sm:grid-cols-[1fr_auto] gap-2 py-2 border-b border-dotted border-line last:border-none text-sm"><span>{item.name}</span><span className={item.change == null ? "text-ink-soft" : item.change > 0 ? "text-brick" : "text-teal"}>{item.change == null ? "Base anterior insuficiente" : `${item.change > 0 ? "↑" : "↓"} ${fmtPct(Math.abs(item.change))}`} · {fmtBs(item.previous, state.profile.currency)} → {fmtBs(item.current, state.profile.currency)}</span></div>) : <Empty text="Aún no hay dos periodos equivalentes con muestras suficientes." />}</div></Card>
    <Card title="Insights">{insights.length ? <div className="flex flex-col gap-4">{insights.map((item) => <InsightCard key={item.id} insight={item} />)}</div> : <Empty text="Registra movimientos reales para recibir observaciones basadas en tus datos." />}</Card>
    <Card title="Cuotas y tarjetas"><details><summary className="cursor-pointer text-sm">Ver y administrar mis deudas</summary><div className="mt-4"><Deudas /></div></details></Card>
    <Card title="Ahorros para imprevistos"><details><summary className="cursor-pointer text-sm">Ver reserva y referencia de meses</summary><div className="mt-4"><FondoEmergencia /></div></details></Card>
    </>}
    <SectionGuide section="analysis" autoOpen={!setup} />
  </div>;
}

function SetupState({ title, text, onClick }) { return <div className="py-3"><p className="font-medium">{title}</p><p className="text-sm text-ink-soft mt-2">{text}</p><Button className="mt-4" size="sm" onClick={onClick}>Completar datos</Button></div>; }
function Empty({ text }) { return <div className="text-ink-soft text-sm py-4"><p>{text}</p><a href="/movimientos" className="underline">Registrar movimientos</a></div>; }
