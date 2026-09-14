import React from "react";
import { CheckCircle2 } from "lucide-react";
import { Button } from "../components/ui/primitives.jsx";

export function OnboardingComplete({ onBack, onFinish }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-12 text-center">
      <div className="w-full max-w-md bg-paper border border-line rounded p-7 sm:p-9">
        <div className="w-14 h-14 rounded-full bg-teal/10 flex items-center justify-center mx-auto">
          <CheckCircle2 size={28} className="text-teal" />
        </div>
        <h1 className="font-display text-3xl font-semibold mt-5">¡Todo listo!</h1>
        <p className="text-ink-soft text-sm mt-3">
          Ya tienes las bases para comenzar. A medida que registres más información, tu Copiloto podrá ayudarte con
          recomendaciones cada vez más útiles.
        </p>
        <div className="flex items-center justify-between gap-3 mt-7">
          <Button variant="secondary" onClick={onBack}>Atrás</Button>
          <Button onClick={onFinish}>Comenzar</Button>
        </div>
      </div>
    </div>
  );
}

