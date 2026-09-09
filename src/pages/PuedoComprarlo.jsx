import React, { useState } from "react";
import { useFinanceState } from "../context/FinanceContext.jsx";
import { Card, Field, Input, Button } from "../components/ui/primitives.jsx";
import { AlertBanner } from "../components/finance/cards.jsx";
import { evaluatePurchase } from "../services/financial/purchaseAdvisor.js";
import { fmtBs } from "../services/financial/format.js";

export default function PuedoComprarlo() {
  const state = useFinanceState();
  const [nombre, setNombre] = useState("");
  const [precio, setPrecio] = useState("");
  const [resultado, setResultado] = useState(null);

  function evaluar(e) {
    e.preventDefault();
    if (!precio) return;
    setResultado(evaluatePurchase(state, Number(precio)));
  }

  const emoji = resultado?.verdict === "si" ? "🟢" : resultado?.verdict === "precaucion" ? "🟡" : resultado?.verdict === "sin_datos" ? "ℹ️" : "🔴";
  const level = resultado?.verdict === "si" ? "positive" : resultado?.verdict === "precaucion" ? "warning" : resultado?.verdict === "sin_datos" ? "neutral" : "danger";

  return (
    <div className="flex flex-col gap-5 max-w-lg">
      <h1 className="font-display text-2xl font-semibold">¿Puedo permitírmelo?</h1>
      <p className="text-ink-soft text-sm">
        No es solo comparar contra tu saldo: revisamos tu dinero disponible, tus próximos compromisos, tu deuda y
        tus objetivos.
      </p>

      <Card>
        <form onSubmit={evaluar} className="flex flex-col gap-3">
          <Field label="¿Qué quieres comprar?">
            <Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej. Laptop" />
          </Field>
          <Field label="Precio (Bs)">
            <Input type="number" value={precio} onChange={(e) => setPrecio(e.target.value)} required />
          </Field>
          <Button type="submit">Evaluar</Button>
        </form>
      </Card>

      {resultado && (
        <AlertBanner level={level}>
          <div className="font-medium mb-1">
            {emoji} {resultado.label}
          </div>
          <div>{resultado.explanation}</div>
          {nombre && <div className="text-xs mt-2 opacity-80">Sobre: {nombre}{precio ? ` (${fmtBs(precio)})` : ""}</div>}
        </AlertBanner>
      )}
    </div>
  );
}
