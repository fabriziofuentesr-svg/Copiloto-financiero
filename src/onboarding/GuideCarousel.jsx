import React, { useState } from "react";
import { ArrowLeftRight, Target, BarChart3, Bot, ShoppingBag, Compass, Check } from "lucide-react";
import { Button } from "../components/ui/primitives.jsx";

const STEPS = [
  {
    icon: Compass,
    title: "Tu dinero, bajo control",
    text: "Un copiloto financiero personal que te ayuda a entender tu dinero, organizar tus finanzas y tomar mejores decisiones.",
    introduction: true,
  },
  {
    icon: ArrowLeftRight,
    title: "Movimientos",
    text: "Registra tus ingresos y gastos para que el Copiloto pueda entender cómo utilizas tu dinero.",
  },
  {
    icon: Target,
    title: "Planes de Ahorro",
    text: "Crea objetivos y separa dinero real con aportes protegidos o transferencias a cuentas de ahorro.",
  },
  {
    icon: BarChart3,
    title: "Mi mes",
    text: "Prepara el Plan del mes, sigue tus límites y consulta la proyección, Salud financiera y comparaciones.",
  },
  {
    icon: Bot,
    title: "Copiloto",
    text: "Pregúntale al Copiloto sobre tus finanzas y recibe recomendaciones basadas en tus datos.",
  },
  {
    icon: ShoppingBag,
    title: "¿Puedo comprarlo?",
    text: "Antes de realizar una compra, comprueba si realmente puedes permitírtela sin comprometer tus finanzas.",
  },
];

// Se usa tanto en el onboarding (a pantalla completa) como reabierta desde
// Configuración/Ayuda (dentro de un modal). El contenido es el mismo.
export function GuideCarousel({ onFinish, onSkip, onBackStart, includeIntroduction = true, initialStep = 0 }) {
  const visibleSteps = includeIntroduction ? STEPS : STEPS.slice(1);
  const [step, setStep] = useState(() => Math.min(initialStep, visibleSteps.length - 1));
  const isLast = step === visibleSteps.length - 1;
  const current = visibleSteps[step];
  const Icon = current.icon;
  const displayedStep = step + 1;

  return (
    <div className="flex flex-col items-center text-center gap-5 py-2">
      <div className="flex gap-1.5">
        {visibleSteps.map((item, i) => <span key={item.title} className={`h-1.5 rounded-full transition-all ${i === step ? "w-6 bg-ochre" : "w-1.5 bg-paper-raised"}`} />)}
      </div>

      <div className="w-14 h-14 rounded-full bg-teal/10 flex items-center justify-center">
        <Icon size={26} className="text-teal" />
      </div>

      <div>
        <div className="text-xs text-ink-soft mb-1">
          {`Paso ${displayedStep} de ${visibleSteps.length}`}
        </div>
        <h3 className="font-display text-xl font-semibold">{current.title}</h3>
        <p className="text-ink-soft text-sm mt-2 max-w-sm">{current.text}</p>
        {current.introduction ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-5 text-left">
            {["Entiende tu situación financiera", "Organiza tus movimientos", "Planifica tus objetivos", "Analiza tus hábitos", "Toma mejores decisiones"].map((benefit) => (
              <div key={benefit} className="flex items-center gap-2 rounded bg-paper-raised px-3 py-2 text-xs">
                <Check size={14} className="text-teal shrink-0" />
                <span>{benefit}</span>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <div className="flex items-center justify-between w-full gap-2 mt-2">
        <div>
          {step > 0 ? (
            <Button variant="secondary" size="sm" onClick={() => setStep((s) => s - 1)}>
              Atrás
            </Button>
          ) : onBackStart ? (
            <Button variant="secondary" size="sm" onClick={onBackStart}>Atrás</Button>
          ) : null}
        </div>
        <div className="flex gap-2">
          {!isLast && (
            <Button variant="ghost" size="sm" onClick={onSkip}>
              Omitir
            </Button>
          )}
          {isLast ? (
            <Button size="sm" onClick={onFinish}>
              Finalizar guía
            </Button>
          ) : (
            <Button size="sm" onClick={() => setStep((s) => s + 1)}>
              Siguiente
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
