import React, { useState } from "react";
import { ArrowLeftRight, Target, BarChart3, Bot, ShoppingBag } from "lucide-react";
import { Button } from "../components/ui/primitives.jsx";

const STEPS = [
  {
    icon: ArrowLeftRight,
    title: "Movimientos",
    text: "Registra tus ingresos y gastos para que el Copiloto pueda entender cómo utilizas tu dinero.",
  },
  {
    icon: Target,
    title: "Planes",
    text: "Crea objetivos, planifica tu ahorro, administra tus deudas y organiza tus prioridades financieras.",
  },
  {
    icon: BarChart3,
    title: "Análisis",
    text: "Consulta cómo está evolucionando tu situación financiera y descubre patrones en tus finanzas.",
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
export function GuideCarousel({ onFinish, onSkip }) {
  const [step, setStep] = useState(0);
  const isLast = step === STEPS.length - 1;
  const current = STEPS[step];
  const Icon = current.icon;

  return (
    <div className="flex flex-col items-center text-center gap-5 py-2">
      <div className="flex gap-1.5">
        {STEPS.map((_, i) => (
          <span key={i} className={`h-1.5 rounded-full transition-all ${i === step ? "w-6 bg-ochre" : "w-1.5 bg-paper-raised"}`} />
        ))}
      </div>

      <div className="w-14 h-14 rounded-full bg-teal/10 flex items-center justify-center">
        <Icon size={26} className="text-teal" />
      </div>

      <div>
        <div className="text-xs text-ink-soft mb-1">Paso {step + 1} de {STEPS.length}</div>
        <h3 className="font-display text-xl font-semibold">{current.title}</h3>
        <p className="text-ink-soft text-sm mt-2 max-w-sm">{current.text}</p>
      </div>

      <div className="flex items-center justify-between w-full gap-2 mt-2">
        <div>
          {step > 0 && (
            <Button variant="secondary" size="sm" onClick={() => setStep((s) => s - 1)}>
              Atrás
            </Button>
          )}
        </div>
        <div className="flex gap-2">
          {!isLast && (
            <Button variant="ghost" size="sm" onClick={onSkip}>
              Omitir
            </Button>
          )}
          {isLast ? (
            <Button size="sm" onClick={onFinish}>
              Comenzar a usar la app
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
