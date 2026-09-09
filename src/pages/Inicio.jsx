import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus, Minus, Target, HelpCircle, Bot } from "lucide-react";
import { useFinanceState } from "../context/FinanceContext.jsx";
import { Card, Button, ProgressBar } from "../components/ui/primitives.jsx";
import { FinancialScoreGauge } from "../components/finance/FinancialScoreGauge.jsx";
import { InsightCard } from "../components/finance/cards.jsx";
import {
  calculateFinancialHealth,
  calculateAvailableMoney,
  summarizeMonth,
  getUpcomingCommitments,
  projectBalance,
} from "../services/financial/calculations.js";
import { getMainInsight } from "../services/financial/insights.js";
import { fmtBs, fmtFecha } from "../services/financial/format.js";

const BREAKDOWN_LABELS = {
  liquidez: "Liquidez",
  ahorro: "Ahorro",
  gastos: "Gastos",
  endeudamiento: "Endeudamiento",
  estabilidad: "Estabilidad",
};

export default function Inicio() {
  const state = useFinanceState();
  const navigate = useNavigate();

  const health = calculateFinancialHealth(state);
  const { totalBalance, committed, available } = calculateAvailableMoney(state);
  const thisMonth = summarizeMonth(state, "current");
  const lastMonth = summarizeMonth(state, "previous");
  const commitments = getUpcomingCommitments(state, 30).slice(0, 4);
  const insight = getMainInsight(state);
  const projection = projectBalance(state, 30);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-display text-2xl font-semibold">Hola, {state.profile.name}</h1>
        <p className="text-ink-soft text-sm mt-0.5">Así está tu situación financiera hoy.</p>
      </div>

      {/* Acciones rápidas */}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => navigate("/movimientos?nuevo=gasto")}>
          <Minus size={14} /> Registrar gasto
        </Button>
        <Button size="sm" variant="secondary" onClick={() => navigate("/movimientos?nuevo=ingreso")}>
          <Plus size={14} /> Registrar ingreso
        </Button>
        <Button size="sm" variant="secondary" onClick={() => navigate("/planes?tab=objetivos&nuevo=1")}>
          <Target size={14} /> Agregar objetivo
        </Button>
        <Button size="sm" variant="secondary" onClick={() => navigate("/puedo-comprarlo")}>
          <HelpCircle size={14} /> ¿Puedo comprarlo?
        </Button>
        <Button size="sm" variant="secondary" onClick={() => navigate("/copiloto")}>
          <Bot size={14} /> Preguntar al Copiloto
        </Button>
      </div>

      <div className="grid md:grid-cols-2 gap-5">
        <Card title="Salud financiera">
          <FinancialScoreGauge score={health.score} />
          <p className="text-sm text-ink-soft mt-3">{health.resumen}</p>
          <div className="mt-4 flex flex-col gap-2">
            {Object.entries(health.breakdown).map(([key, value]) => (
              <div key={key}>
                <div className="flex justify-between text-xs mb-1">
                  <span>{BREAKDOWN_LABELS[key]}</span>
                  <span className="text-ink-soft">{value}/100</span>
                </div>
                <ProgressBar value={value} color="#1F5C56" />
              </div>
            ))}
          </div>
        </Card>

        <Card title="Dinero disponible">
          <div className="font-display text-3xl font-semibold text-teal">{fmtBs(available)}</div>
          <p className="text-ink-soft text-xs mt-1">Esto no es lo mismo que tu saldo total.</p>
          <div className="mt-4 flex flex-col gap-2 text-sm">
            <div className="flex justify-between leader-dotted pb-1.5">
              <span className="text-ink-soft">Saldo total</span>
              <span className="tabular-nums">{fmtBs(totalBalance)}</span>
            </div>
            <div className="flex justify-between leader-dotted pb-1.5">
              <span className="text-ink-soft">Comprometido (próx. 30 días)</span>
              <span className="tabular-nums">− {fmtBs(committed)}</span>
            </div>
            <div className="flex justify-between font-medium">
              <span>Disponible</span>
              <span className="tabular-nums">{fmtBs(available)}</span>
            </div>
          </div>
        </Card>

        <Card title="Resumen mensual">
          <div className="flex flex-col gap-2 text-sm">
            <Row label="Ingresos" value={thisMonth.ingresos} prev={lastMonth.ingresos} />
            <Row label="Gastos" value={thisMonth.gastos} prev={lastMonth.gastos} invert />
            <Row label="Ahorro" value={thisMonth.ahorro} prev={lastMonth.ahorro} />
          </div>
        </Card>

        <Card title="Proyección de fin de mes">
          <div className="font-display text-3xl font-semibold">{fmtBs(projection.end)}</div>
          <p className="text-ink-soft text-sm mt-1">
            Con tus ingresos y gastos actuales, esperamos que en 30 días tu saldo disponible ronde los{" "}
            {fmtBs(projection.end)}.
          </p>
          <Link to="/flujo-de-dinero" className="text-ochre text-xs underline mt-2 inline-block">
            Ver flujo de dinero completo
          </Link>
        </Card>
      </div>

      <Card title="Próximos compromisos">
        <div className="flex flex-col">
          {commitments.map((c) => (
            <div key={c.id + c.date} className="flex justify-between py-2 border-b border-dotted border-line last:border-none text-sm">
              <span>{c.name}</span>
              <span className="text-ink-soft">{fmtFecha(c.date)}</span>
              <span className="tabular-nums">− {fmtBs(c.amount)}</span>
            </div>
          ))}
          {commitments.length === 0 && <p className="text-ink-soft text-sm">No hay compromisos próximos registrados.</p>}
        </div>
      </Card>

      <Card title="💡 Tu principal insight">
        <InsightCard insight={insight} />
        <Link to="/analisis" className="text-ochre text-xs underline mt-3 inline-block">
          Ver análisis
        </Link>
      </Card>
    </div>
  );
}

function Row({ label, value, prev, invert = false }) {
  const diff = value - prev;
  const improved = invert ? diff < 0 : diff > 0;
  return (
    <div className="flex justify-between items-baseline leader-dotted pb-1.5">
      <span className="text-ink-soft">{label}</span>
      <span className="tabular-nums">
        {fmtBs(value)}{" "}
        {prev > 0 && (
          <span className={`text-xs ${improved ? "text-teal" : "text-brick"}`}>
            ({diff >= 0 ? "+" : ""}
            {fmtBs(diff)} vs mes ant.)
          </span>
        )}
      </span>
    </div>
  );
}
