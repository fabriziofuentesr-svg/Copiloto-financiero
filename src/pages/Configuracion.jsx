import React, { useState } from "react";
import { useFinanceState, useFinanceDispatch } from "../context/FinanceContext.jsx";
import { Card, Field, Input, Button } from "../components/ui/primitives.jsx";

export default function Configuracion() {
  const state = useFinanceState();
  const dispatch = useFinanceDispatch();
  const [nombre, setNombre] = useState(state.profile.name);

  return (
    <div className="flex flex-col gap-5 max-w-md">
      <h1 className="font-display text-2xl font-semibold">Configuración</h1>

      <Card title="Perfil">
        <div className="flex flex-col gap-3">
          <Field label="Nombre">
            <Input value={nombre} onChange={(e) => setNombre(e.target.value)} />
          </Field>
          <div className="text-sm text-ink-soft">Moneda principal: {state.profile.currency}</div>
          <div className="text-sm text-ink-soft">Ingreso mensual de referencia: Bs {state.profile.monthlyIncome}</div>
          <div className="text-sm text-ink-soft">Día de pago: {state.profile.payDay}</div>
        </div>
      </Card>

      <Card title="Datos">
        <p className="text-sm text-ink-soft mb-3">
          Todo se guarda en este navegador. Puedes reiniciar el prototipo a los datos de ejemplo en cualquier momento.
        </p>
        <Button variant="danger" onClick={() => dispatch({ type: "RESET_TO_MOCK" })}>
          Reiniciar a datos de ejemplo
        </Button>
      </Card>
    </div>
  );
}
