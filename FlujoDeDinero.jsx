import React from "react";
import { useFinanceState } from "../context/FinanceContext.jsx";
import { Card } from "../components/ui/primitives.jsx";
import { AlertBanner } from "../components/finance/cards.jsx";
import { projectBalance, calculateAvailableMoney } from "../services/financial/calculations.js";
import { fmtBs, fmtFecha } from "../services/financial/format.js";

export default function FlujoDeDinero() {
  const state = useFinanceState();
  const { available } = calculateAvailableMoney(state);
  const projection = projectBalance(state, 30);

  return (
    <div className="flex flex-col gap-5">
      <h1 className="font-display text-2xl font-semibold">Flujo de dinero</h1>
      <p className="text-ink-soft text-sm">Proyección de tu liquidez en los próximos 30 días.</p>

      {projection.atRisk && (
        <AlertBanner level="danger">
          🔴 Riesgo de liquidez. Tus obligaciones previstas podrían superar tu dinero disponible antes de tu próximo
          ingreso.
        </AlertBanner>
      )}

      <Card>
        <div className="flex flex-col">
          <div className="flex justify-between py-2.5 border-b border-line text-sm font-medium">
            <span>HOY</span>
            <span className="tabular-nums">{fmtBs(available)}</span>
          </div>
          {projection.timeline.map((e) => (
            <div key={e.id + e.date} className="flex justify-between items-center py-2.5 border-b border-dotted border-line text-sm">
              <div>
                <div>{e.name}</div>
                <div className="text-ink-soft text-xs">{fmtFecha(e.date)}</div>
              </div>
              <div className="text-right">
                <div className={`tabular-nums ${e.delta >= 0 ? "text-teal" : "text-ink"}`}>
                  {e.delta >= 0 ? "+" : "−"} {fmtBs(Math.abs(e.delta))}
                </div>
                <div className={`text-xs tabular-nums ${e.balanceAfter < 0 ? "text-brick" : "text-ink-soft"}`}>
                  saldo: {fmtBs(e.balanceAfter)}
                </div>
              </div>
            </div>
          ))}
          <div className="flex justify-between pt-3 font-display font-semibold text-lg">
            <span>SALDO PROYECTADO</span>
            <span className="tabular-nums">{fmtBs(projection.end)}</span>
          </div>
        </div>
      </Card>
    </div>
  );
}
