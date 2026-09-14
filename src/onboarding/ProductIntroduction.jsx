import React from "react";
import { BarChart3, Bot, Check, PiggyBank, ShoppingBag, WalletCards } from "lucide-react";
import { Button } from "../components/ui/primitives.jsx";

const BENEFITS = [
  { icon: BarChart3, text: "Entender tu situación financiera" },
  { icon: WalletCards, text: "Organizar tus ingresos y gastos" },
  { icon: PiggyBank, text: "Planificar tus objetivos" },
  { icon: BarChart3, text: "Analizar tus hábitos" },
  { icon: Bot, text: "Recibir recomendaciones" },
  { icon: ShoppingBag, text: "Evaluar decisiones de compra" },
];

export function ProductIntroduction({ onBack, onContinue }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 sm:px-6 py-10">
      <div className="w-full max-w-2xl bg-paper border border-line rounded p-6 sm:p-9">
        <div className="inline-flex items-center gap-2 rounded-full bg-teal/10 px-3 py-1 text-xs font-medium text-teal">
          <Check size={14} /> Mucho más que registrar gastos
        </div>
        <h1 className="font-display text-3xl sm:text-4xl font-semibold mt-5">Tu dinero, bajo control.</h1>
        <p className="text-ink-soft mt-3 max-w-xl">
          Copiloto Financiero te ayuda a entender tu situación, organizar tu dinero, anticiparte a tus próximos
          compromisos y tomar mejores decisiones.
        </p>

        <div className="grid sm:grid-cols-2 gap-3 mt-7">
          {BENEFITS.map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-center gap-3 rounded border border-line bg-paper-raised p-3 text-sm">
              <Icon size={17} className="text-teal shrink-0" />
              <span>{text}</span>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between gap-3 mt-8">
          <Button variant="secondary" onClick={onBack}>Atrás</Button>
          <Button onClick={onContinue}>Configurar mi Copiloto</Button>
        </div>
      </div>
    </div>
  );
}

