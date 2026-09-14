import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis } from "recharts";
import { useFinanceState } from "../context/FinanceContext.jsx";
import { Button, Card, Modal, ProgressBar } from "../components/ui/primitives.jsx";
import { InsightCard } from "../components/finance/cards.jsx";
import { FinancialHealthSetupForm, ProjectionSetupForm } from "../components/finance/AnalysisSetupForms.jsx";
import { SectionGuide } from "../components/SectionGuide.jsx";
import { calculateFinancialHealth, getCategoryTrends, projectBalance, summarizeByCategory } from "../services/financial/calculations.js";
import { getFinancialDataReadiness } from "../services/financial/readiness.js";
import { generateInsights } from "../services/financial/insights.js";
import { fmtBs, fmtPct } from "../services/financial/format.js";

const HEALTH_LABELS = {
  flujoCaja: "Flujo de caja",
  reserva: "Reserva financiera",
  endeudamiento: "Endeudamiento",
  planificacion: "Planificación",
};

function monthLabel(key) {
  const [year, month] = key.split("-").map(Number);
  return new Intl.DateTimeFormat("es-BO", { month: "long", year: "numeric" }).format(new Date(year, month - 1, 1));
}

function missingText(items) {
  return items.length ? `Completa ${items.join(", ")}.` : "Completa la configuración necesaria.";
}

export default function Analisis() {
  const state = useFinanceState();
  const [params, setParams] = useSearchParams();
  const [setup, setSetup] = useState(params.get("config") || null);
  const readiness = getFinancialDataReadiness(state);
  const health = calculateFinancialHealth(state);
  const projection = projectBalance(state, 30);
  const byCategory = summarizeByCategory(state, "current");
  const trends = getCategoryTrends(state);
  const insights = generateInsights(state);
  const comparison = readiness.comparableMonths;

  useEffect(() => {
    const requested = params.get("config");
    if (requested === "health" || requested === "projection") setSetup(requested);
  }, [params]);

  function closeSetup() {
    setSetup(null);
    if (params.has("config")) {
      const next = new URLSearchParams(params);
      next.delete("config");
      setParams(next, { replace: true });
    }
  }

  const comparisonData = comparison ? [
    { name: "Ingresos", actual: comparison.current.ingresos, anterior: comparison.previous.ingresos },
    { name: "Gastos", actual: comparison.current.gastos, anterior: comparison.previous.gastos },
    { name: "Ahorro", actual: comparison.current.ahorro, anterior: comparison.previous.ahorro },
  ] : [];

  return (
    <div className="flex flex-col gap-5">
      <h1 className="font-display text-2xl font-semibold">Análisis</h1>

      <div className="grid md:grid-cols-2 gap-5">
        <Card title="Gastos por categoría">
          {byCategory.length === 0 ? (
            <p className="text-ink-soft text-sm">Sin gastos este mes todavía.</p>
          ) : (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width="55%" height={180}>
                <PieChart>
                  <Pie data={byCategory} dataKey="amount" nameKey="name" innerRadius={45} outerRadius={75} paddingAngle={2}>
                    {byCategory.map((category) => <Cell key={category.categoryId} fill={category.color} />)}
                  </Pie>
                  <Tooltip formatter={(value) => fmtBs(value, state.profile.currency)} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 flex flex-col gap-1.5 text-xs">
                {byCategory.map((category) => (
                  <div key={category.categoryId} className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: category.color }} />{category.name}</span>
                    <span className="tabular-nums">{fmtBs(category.amount, state.profile.currency)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>

        <Card title="Comparación mensual">
          {!readiness.canCompareMonths ? (
            <div className="py-8 text-center"><p className="font-medium">Comparación disponible próximamente</p><p className="text-ink-soft text-sm mt-2">Necesitamos ingresos y gastos reales de al menos dos meses distintos para comparar tu evolución.</p></div>
          ) : (
            <>
              <p className="text-xs text-ink-soft mb-2 capitalize">{monthLabel(comparison.current.key)} frente a {monthLabel(comparison.previous.key)}</p>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={comparisonData}>
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} axisLine={{ stroke: "#D3CCB6" }} tickLine={false} />
                  <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={40} />
                  <Tooltip formatter={(value) => fmtBs(value, state.profile.currency)} />
                  <Bar dataKey="anterior" fill="#D3CCB6" name={monthLabel(comparison.previous.key)} radius={[3, 3, 0, 0]} />
                  <Bar dataKey="actual" fill="#1F5C56" name={monthLabel(comparison.current.key)} radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </>
          )}
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-5">
        <Card title="Salud financiera">
          {!health.available ? (
            <SetupState title="Salud financiera aún no disponible" text={missingText(readiness.healthMissing)} onClick={() => setSetup("health")} />
          ) : (
            <>
              <div className="font-display text-4xl font-semibold text-teal">{health.score}%</div>
              <p className="text-sm text-ink-soft mt-2">{health.resumen}</p>
              <div className="mt-4 flex flex-col gap-2">
                {Object.entries(health.breakdown).map(([key, value]) => (
                  <div key={key}><div className="flex justify-between text-xs mb-1"><span>{HEALTH_LABELS[key]}</span><span>{value}%</span></div><ProgressBar value={value} /></div>
                ))}
              </div>
              <Button className="mt-4" size="sm" variant="secondary" onClick={() => setSetup("health")}>Actualizar configuración</Button>
            </>
          )}
        </Card>

        <Card title="Proyección financiera">
          {!projection.available ? (
            <SetupState title="Proyección aún no disponible" text={missingText(readiness.projectionMissing)} onClick={() => setSetup("projection")} />
          ) : (
            <div className="flex flex-col gap-2 text-sm">
              <ProjectionRow label="Saldo actual" value={projection.start} state={state} />
              <ProjectionRow label="Ingresos esperados" value={projection.expectedIncome} state={state} positive />
              <ProjectionRow label="Gastos variables estimados" value={projection.expectedVariableExpenses} state={state} negative />
              <ProjectionRow label="Compromisos registrados" value={projection.commitments} state={state} negative />
              <div className="flex justify-between border-t border-line pt-3 mt-1 font-semibold"><span>Saldo estimado en 30 días</span><span className={projection.end < 0 ? "text-brick" : "text-teal"}>{fmtBs(projection.end, state.profile.currency)}</span></div>
              <p className="text-xs text-ink-soft">Resultado estimado: {projection.end >= projection.start ? "superávit" : "reducción de saldo"} de {fmtBs(Math.abs(projection.end - projection.start), state.profile.currency)}.</p>
              <Button className="mt-2 self-start" size="sm" variant="secondary" onClick={() => setSetup("projection")}>Actualizar supuestos</Button>
            </div>
          )}
        </Card>
      </div>

      <Card title="Tendencias por categoría">
        <div className="flex flex-col">
          {trends.map((trend) => (
            <div key={trend.categoryId} className="flex justify-between items-center py-2 border-b border-dotted border-line last:border-none text-sm"><span>{trend.name}</span><span className={trend.change > 0 ? "text-brick" : trend.change < 0 ? "text-teal" : "text-ink-soft"}>{trend.change > 0 ? "↑" : trend.change < 0 ? "↓" : "→"} {fmtPct(Math.abs(trend.change))}</span></div>
          ))}
          {trends.length === 0 && <p className="text-ink-soft text-sm">Necesitamos gastos reales de dos meses distintos para mostrar tendencias.</p>}
        </div>
      </Card>

      <Card title="Insights">
        {insights.length === 0 ? <p className="text-ink-soft text-sm">Registra movimientos para comenzar a recibir observaciones basadas en tus datos.</p> : <div className="flex flex-col gap-4">{insights.map((insight) => <InsightCard key={insight.id} insight={insight} />)}</div>}
      </Card>

      <SectionGuide section="analysis" autoOpen={!setup} />
      <Modal open={setup === "health"} onClose={closeSetup} title="Configurar salud financiera"><FinancialHealthSetupForm onSuccess={closeSetup} /></Modal>
      <Modal open={setup === "projection"} onClose={closeSetup} title="Configurar proyección"><ProjectionSetupForm onSuccess={closeSetup} /></Modal>
    </div>
  );
}

function SetupState({ title, text, onClick }) {
  return <div className="py-5"><p className="font-medium">{title}</p><p className="text-ink-soft text-sm mt-2">{text}</p><Button className="mt-4" size="sm" onClick={onClick}>Configurar</Button></div>;
}

function ProjectionRow({ label, value, state, positive = false, negative = false }) {
  return <div className="flex justify-between leader-dotted pb-1.5"><span className="text-ink-soft">{label}</span><span className={positive ? "text-teal" : negative ? "text-brick" : ""}>{positive ? "+ " : negative ? "− " : ""}{fmtBs(value, state.profile.currency)}</span></div>;
}
