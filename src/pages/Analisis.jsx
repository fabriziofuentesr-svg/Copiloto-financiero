import React from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis } from "recharts";
import { useFinanceState } from "../context/FinanceContext.jsx";
import { Card } from "../components/ui/primitives.jsx";
import { InsightCard } from "../components/finance/cards.jsx";
import { summarizeByCategory, summarizeMonth, getCategoryTrends } from "../services/financial/calculations.js";
import { generateInsights } from "../services/financial/insights.js";
import { fmtBs, fmtPct } from "../services/financial/format.js";

export default function Analisis() {
  const state = useFinanceState();
  const byCategory = summarizeByCategory(state, "current");
  const current = summarizeMonth(state, "current");
  const previous = summarizeMonth(state, "previous");
  const trends = getCategoryTrends(state);
  const insights = generateInsights(state);

  const comparisonData = [
    { name: "Ingresos", actual: current.ingresos, anterior: previous.ingresos },
    { name: "Gastos", actual: current.gastos, anterior: previous.gastos },
    { name: "Ahorro", actual: current.ahorro, anterior: previous.ahorro },
  ];

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
                    {byCategory.map((c) => (
                      <Cell key={c.categoryId} fill={c.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => fmtBs(v)} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 flex flex-col gap-1.5 text-xs">
                {byCategory.map((c) => (
                  <div key={c.categoryId} className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: c.color }} />
                      {c.name}
                    </span>
                    <span className="tabular-nums">{fmtBs(c.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>

        <Card title="Comparación mensual">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={comparisonData}>
              <XAxis dataKey="name" tick={{ fontSize: 12 }} axisLine={{ stroke: "#D3CCB6" }} tickLine={false} />
              <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={40} />
              <Tooltip formatter={(v) => fmtBs(v)} />
              <Bar dataKey="anterior" fill="#D3CCB6" name="Mes anterior" radius={[3, 3, 0, 0]} />
              <Bar dataKey="actual" fill="#1F5C56" name="Mes actual" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <Card title="Tendencias por categoría">
        <div className="flex flex-col">
          {trends.map((t) => (
            <div key={t.categoryId} className="flex justify-between items-center py-2 border-b border-dotted border-line last:border-none text-sm">
              <span>{t.name}</span>
              <span className={t.change > 0 ? "text-brick" : t.change < 0 ? "text-teal" : "text-ink-soft"}>
                {t.change > 0 ? "↑" : t.change < 0 ? "↓" : "→"} {fmtPct(Math.abs(t.change))}
              </span>
            </div>
          ))}
          {trends.length === 0 && <p className="text-ink-soft text-sm">Todavía no hay suficiente historial para comparar.</p>}
        </div>
      </Card>

      <Card title="Insights">
        {insights.length === 0 ? (
          <p className="text-ink-soft text-sm">
            Aún no hay suficientes movimientos para generar insights. Empieza registrando tus ingresos y gastos
            desde Movimientos.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {insights.map((i) => (
              <InsightCard key={i.id} insight={i} />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
