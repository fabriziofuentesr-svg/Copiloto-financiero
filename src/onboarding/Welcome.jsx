import React from "react";
import { Compass } from "lucide-react";
import { Button } from "../components/ui/primitives.jsx";

export function Welcome({ onStart }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center text-center px-6 py-16">
      <div className="w-14 h-14 rounded-full bg-teal/10 flex items-center justify-center mb-6">
        <Compass size={26} className="text-teal" />
      </div>
      <h1 className="font-display text-3xl sm:text-4xl font-semibold max-w-md">Bienvenido a tu Copiloto Financiero</h1>
      <p className="text-ink-soft mt-4 max-w-md">
        Organiza tus finanzas, entiende tu situación financiera y toma mejores decisiones con tu dinero.
      </p>
      <Button size="lg" className="mt-8" onClick={onStart}>
        Comenzar
      </Button>
    </div>
  );
}
