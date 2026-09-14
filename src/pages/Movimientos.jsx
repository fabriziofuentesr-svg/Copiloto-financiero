import React, { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Plus } from "lucide-react";
import { useFinanceState } from "../context/FinanceContext.jsx";
import { Card, Button, Modal, Field, Input, Select } from "../components/ui/primitives.jsx";
import { TransactionItem } from "../components/finance/cards.jsx";
import { TransactionForm } from "../components/finance/TransactionForm.jsx";

export default function Movimientos() {
  const state = useFinanceState();
  const [params] = useSearchParams();
  const [modalOpen, setModalOpen] = useState(Boolean(params.get("nuevo")));
  const [movementType, setMovementType] = useState(params.get("nuevo") === "ingreso" ? "ingreso" : "gasto");

  const [filtroCategoria, setFiltroCategoria] = useState("todas");
  const [filtroCuenta, setFiltroCuenta] = useState("todas");
  const [busqueda, setBusqueda] = useState("");
  const [orden, setOrden] = useState("reciente");

  function abrirNuevo(tipo) {
    setMovementType(tipo);
    setModalOpen(true);
  }

  const movimientosFiltrados = useMemo(() => {
    let list = [...state.transactions];
    if (filtroCategoria !== "todas") list = list.filter((t) => t.category === filtroCategoria);
    if (filtroCuenta !== "todas") list = list.filter((t) => t.accountId === filtroCuenta);
    if (busqueda.trim()) list = list.filter((t) => t.description.toLowerCase().includes(busqueda.toLowerCase()));
    list.sort((a, b) => {
      if (orden === "reciente") return new Date(b.date) - new Date(a.date);
      if (orden === "antiguo") return new Date(a.date) - new Date(b.date);
      if (orden === "mayor") return b.amount - a.amount;
      return a.amount - b.amount;
    });
    return list;
  }, [state.transactions, filtroCategoria, filtroCuenta, busqueda, orden]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="font-display text-2xl font-semibold">Movimientos</h1>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={() => abrirNuevo("ingreso")}>
            <Plus size={14} /> Ingreso
          </Button>
          <Button size="sm" onClick={() => abrirNuevo("gasto")}>
            <Plus size={14} /> Gasto
          </Button>
        </div>
      </div>

      <Card>
        <div className="grid sm:grid-cols-4 gap-3">
          <Field label="Buscar">
            <Input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Descripción..." />
          </Field>
          <Field label="Categoría">
            <Select value={filtroCategoria} onChange={(e) => setFiltroCategoria(e.target.value)}>
              <option value="todas">Todas</option>
              {state.categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Cuenta">
            <Select value={filtroCuenta} onChange={(e) => setFiltroCuenta(e.target.value)}>
              <option value="todas">Todas</option>
              {state.accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Ordenar por">
            <Select value={orden} onChange={(e) => setOrden(e.target.value)}>
              <option value="reciente">Más reciente</option>
              <option value="antiguo">Más antiguo</option>
              <option value="mayor">Mayor monto</option>
              <option value="menor">Menor monto</option>
            </Select>
          </Field>
        </div>
      </Card>

      <Card>
        {movimientosFiltrados.length === 0 ? (
          <p className="text-ink-soft text-sm">No hay movimientos que coincidan con el filtro.</p>
        ) : (
          movimientosFiltrados.map((tx) => (
            <TransactionItem
              key={tx.id}
              tx={tx}
              categoryName={state.categories.find((c) => c.id === tx.category)?.name || tx.category}
              accountName={state.accounts.find((a) => a.id === tx.accountId)?.name || "—"}
              currency={state.profile.currency}
              onDelete={() => dispatch({ type: "DELETE_TRANSACTION", payload: tx.id })}
            />
          ))
        )}
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={movementType === "ingreso" ? "Nuevo ingreso" : "Nuevo gasto"}>
        <TransactionForm key={movementType} initialType={movementType} onSuccess={() => setModalOpen(false)} />
      </Modal>
    </div>
  );
}

