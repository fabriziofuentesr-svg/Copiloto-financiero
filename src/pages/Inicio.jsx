import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { Bot, ArrowLeftRight, Target, BarChart3, ShoppingBag, ArrowRight } from "lucide-react";
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
  hasFinancialData,
  getEmergencyFundStatus,
} from "../services/financial/calculations.js";
import { getMainInsight } from "../services/financial/insights.js";
import { fmtBs, fmtFecha, fmtPct } from "../services/financial/format.js";

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
  const conDatos = hasFinancialData(state);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Hola, {state.profile.name}</h1>
        <p className="text-ink-soft text-sm mt-0.5">Este es tu espacio para entender y mejorar tus finanzas.</p>
      </div>

      {/* Accesos rápidos destacados */}
      <div className="grid sm:grid-cols-2 gap-4">
        <AccesoDestacado
          icon={ShoppingBag}
          title="¿Puedo comprarlo?"
          text="Evalúa si una compra te conviene antes de hacerla."
          onClick={() => navigate("/puedo-comprarlo")}
        />
        <AccesoDestacado
          icon={Bot}
          title="Preguntar al Copiloto"
          text="Consulta tus finanzas y recibe recomendaciones."
          onClick={() => navigate("/copiloto")}
        />
      </div>

      {conDatos ? <ResumenFinanciero state={state} /> : <EstadoVacio navigate={navigate} />}

      <QuePuedesHacer state={state} navigate={navigate} conDatos={conDatos} />
    </div>
  );
}

function AccesoDestacado({ icon: Icon, title, text, onClick }) {
  return (
    <button
      onClick={onClick}
      className="text-left border border-line rounded p-5 bg-paper hover:bg-paper-raised transition-colors flex items-start gap-4"
    >
      <div className="w-10 h-10 rounded-full bg-teal/10 flex items-center justify-center shrink-0">
        <Icon size={18} className="text-teal" />
      </div>
      <div>
        <div className="font-display font-semibold">{title}</div>
        <div className="text-ink-soft text-sm mt-0.5">{text}</div>
      </div>
    </button>
  );
}

function EstadoVacio({ navigate }) {
  return (
    <Card className="text-center py-10">
      <p className="font-display text-lg font-semibold">Todavía no tienes datos financieros registrados</p>
      <p className="text-ink-soft text-sm mt-2 max-w-md mx-auto">
        Registra tu primer ingreso o gasto, o agrega una cuenta, para que el Copiloto pueda entender tu situación y
        empezar a ayudarte.
      </p>
      <div className="flex gap-2 justify-center mt-5">
        <Button onClick={() => navigate("/movimientos")}>Ir a Movimientos</Button>
        <Button variant="secondary" onClick={() => navigate("/cuentas")}>Ir a Cuentas</Button>
      </div>
    </Card>
  );
}

function ResumenFinanciero({ state }) {
  const health = calculateFinancialHealth(state);
  const { totalBalance, committed, available } = calculateAvailableMoney(state);
  const thisMonth = summarizeMonth(state, "current");
  const lastMonth = summarizeMonth(state, "previous");
  const commitments = getUpcomingCommitments(state, 30).slice(0, 4);
  const insight = getMainInsight(state);
  const projection = projectBalance(state, 30);

  return (
    <div className="flex flex-col gap-5">
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

function QuePuedesHacer({ state, navigate, conDatos }) {
  const goalsCount = state.goals.length;
  const { progresoPct: emergencyPct, target: emergencyTarget } = getEmergencyFundStatus(state);

  let planesSub = "Aún sin objetivos ni fondo de emergencia";
  if (goalsCount > 0 && emergencyTarget > 0) {
    planesSub = `${goalsCount} objetivo(s) activo(s) · Fondo de emergencia: ${fmtPct(emergencyPct)}`;
  } else if (goalsCount > 0) {
    planesSub = `${goalsCount} objetivo(s) activo(s)`;
  } else if (emergencyTarget > 0) {
    planesSub = `Fondo de emergencia: ${fmtPct(emergencyPct)} completado`;
  }

  const items = [
    {
      icon: ArrowLeftRight,
      title: "Movimientos",
      text: "Registra y organiza tus ingresos y gastos.",
      sub: conDatos ? `${state.transactions.length} movimiento(s) registrados` : "Sin movimientos todavía",
      to: "/movimientos",
    },
    {
      icon: Target,
      title: "Planes",
      text: "Define objetivos, ahorro, fondo de emergencia y gestiona tus deudas.",
      sub: planesSub,
      to: "/planes",
    },
    {
      icon: BarChart3,
      title: "Análisis",
      text: "Comprende tus hábitos financieros y descubre tendencias.",
      sub: "Gráficos y tendencias de tus finanzas",
      to: "/analisis",
    },
    {
      icon: Bot,
      title: "Copiloto",
      text: "Consulta tus finanzas y recibe recomendaciones.",
      sub: "Respuestas basadas en tus datos",
      to: "/copiloto",
    },
    {
      icon: ShoppingBag,
      title: "¿Puedo comprarlo?",
      text: "Evalúa si una compra es conveniente para tu situación financiera.",
      sub: "Antes de gastar, revisa el impacto",
      to: "/puedo-comprarlo",
    },
  ];

  return (
    <div>
      <h2 className="font-display font-semibold text-lg mb-3">¿Qué puedes hacer?</h2>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((item) => (
          <button
            key={item.to}
            onClick={() => navigate(item.to)}
            className="text-left border border-line rounded p-4 bg-paper hover:bg-paper-raised transition-colors flex flex-col gap-2"
          >
            <div className="flex items-center gap-2">
              <item.icon size={16} className="text-teal" />
              <span className="font-medium text-sm">{item.title}</span>
            </div>
            <p className="text-ink-soft text-xs">{item.text}</p>
            <div className="flex items-center justify-between mt-1">
              <span className="text-xs text-ink-soft">{item.sub}</span>
              <ArrowRight size={13} className="text-ink-soft" />
            </div>
          </button>
        ))}
      </div>
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
