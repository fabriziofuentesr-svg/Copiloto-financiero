import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useFinanceState } from "../context/FinanceContext.jsx";
import { AlertBanner } from "../components/finance/cards.jsx";
import { Button, Card, Field, Input } from "../components/ui/primitives.jsx";
import { evaluatePurchase } from "../services/financial/purchaseAdvisor.js";
import { fmtBs } from "../services/financial/format.js";

export default function PuedoComprarlo() {
  const state = useFinanceState();
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [result, setResult] = useState(null);
  function evaluate(event) { event.preventDefault(); const value = Number(price); if (Number.isFinite(value) && value > 0) setResult(evaluatePurchase(state, value)); }
  const level = result?.verdict === "si" ? "positive" : result?.verdict === "precaucion" ? "warning" : result?.verdict === "incomplete" ? "neutral" : "danger";
  const marker = result?.verdict === "si" ? "🟢" : result?.verdict === "precaucion" ? "🟡" : result?.verdict === "incomplete" ? "ℹ️" : "🔴";
  return <div className="flex flex-col gap-5 max-w-4xl">
    <div><h1 className="font-display text-2xl font-semibold">¿Puedo comprarlo?</h1><p className="text-ink-soft text-sm mt-1">Revisamos liquidez, compromisos, deuda, reserva, objetivos y proyección antes de responder.</p></div>
    <Card><form onSubmit={evaluate} className="grid sm:grid-cols-[1fr_12rem_auto] gap-3 items-end"><Field label="¿Qué quieres comprar?"><Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Ej. Laptop" /></Field><Field label={`Precio (${state.profile.currency === "USD" ? "USD" : "Bs"})`}><Input type="number" min="0.01" step="0.01" value={price} onChange={(event) => setPrice(event.target.value)} required /></Field><Button type="submit">Evaluar</Button></form></Card>
    {result ? <>
      <AlertBanner level={level}><p className="font-semibold">{marker} {result.label}</p><p className="mt-1">{result.explanation}</p>{name ? <p className="text-xs mt-2">{name} · {fmtBs(result.price, state.profile.currency)}</p> : null}</AlertBanner>
      <div className="grid md:grid-cols-2 gap-4">
        <Card title="Impacto inmediato"><ResultRow label="Disponible antes" value={result.availableBefore} state={state} /><ResultRow label="Disponible después" value={result.availableAfter} state={state} /><ResultRow label="Compromisos próximos" value={result.commitments} state={state} /><p className={`text-sm mt-3 ${result.commitmentsCovered ? "text-teal" : "text-brick"}`}>{result.commitmentsCovered ? "Compromisos cubiertos" : "Quedarían compromisos sin cubrir"}</p></Card>
        <Card title="Reserva y horizonte"><ResultRow label="Fondo actual" value={result.reserveBefore} state={state} /><ResultRow label="Fondo tras la compra" value={result.reserveAfter} state={state} /><ResultRow label="Reserva mínima" value={result.reserveTarget} state={state} /><p className="text-sm mt-3">Meses esenciales restantes: <strong>{result.reserveMonthsAfter == null ? "No disponible" : result.reserveMonthsAfter.toFixed(1)}</strong></p>{result.goalDelayed ? <p className="text-sm text-brick mt-2">Podría retrasarse: {result.goalDelayed}</p> : null}</Card>
      </div>
      <Card title="Supuestos y calidad"><p className="text-sm">Proyección después de la compra: <strong>{result.projectedAfter == null ? "No disponible" : fmtBs(result.projectedAfter, state.profile.currency)}</strong></p><p className="text-sm mt-1">Deuda registrada: <strong>{fmtBs(result.debtBalance, state.profile.currency)}</strong> · Calidad de datos: <strong>{result.dataQuality}</strong></p><ul className="list-disc pl-5 text-sm text-ink-soft mt-3">{result.assumptions.map((item) => <li key={item}>{item}</li>)}</ul>{result.missing.length ? <div className="mt-4 rounded bg-paper-raised p-3"><p className="font-medium text-sm">Datos que faltan</p><ul className="list-disc pl-5 text-sm text-ink-soft mt-1">{result.missing.map((item) => <li key={item}>{item}</li>)}</ul><div className="flex gap-3 mt-3"><Link to="/mi-mes?config=health" className="text-ochre text-sm underline">Configurar Mi mes</Link><Link to="/cuentas" className="text-ochre text-sm underline">Completar cuentas</Link></div></div> : null}</Card>
    </> : null}
  </div>;
}

function ResultRow({ label, value, state }) { return <div className="flex justify-between leader-dotted py-1.5 text-sm"><span className="text-ink-soft">{label}</span><strong className="tabular-nums">{fmtBs(value, state.profile.currency)}</strong></div>; }
