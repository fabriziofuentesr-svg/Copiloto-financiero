import React, { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Plus } from "lucide-react";
import { useFinanceState, useFinanceDispatch } from "../context/FinanceContext.jsx";
import { Card, Button, Modal, Field, Input, Select } from "../components/ui/primitives.jsx";
import { TransactionItem } from "../components/finance/cards.jsx";

const emptyForm = { description: "", amount: "", date: new Date().toISOString().slice(0, 10), category: "", accountId: "", paymentMethod: "", type: "gasto" };

export default function Movimientos() {
  const state = useFinanceState();
  const dispatch = useFinanceDispatch();
  const [params] = useSearchParams();

  const [modalOpen, setModalOpen] = useState(Boolean(params.get("nuevo")));
  const [form, setForm] = useState({
    ...emptyForm,
    type: params.get("nuevo") === "ingreso" ? "ingreso" : "gasto",
    category: state.categories.find((c) => c.type === (params.get("nuevo") === "ingreso" ? "ingreso" : "gasto"))?.id || "",
    accountId: state.accounts[0]?.id || "",
    paymentMethod: state.paymentMethods[0]?.id || "",
  });

  const [filtroCategoria, setFiltroCategoria] = useState("todas");
  const [filtroCuenta, setFiltroCuenta] = useState("todas");
  const [busqueda, setBusqueda] = useState("");
  const [orden, setOrden] = useState("reciente");

  const categoriasDisponibles = state.categories.filter((c) => c.type === form.type || (form.type === "gasto" && c.type === "gasto"));

  function abrirNuevo(tipo) {
    setForm({
      ...emptyForm,
      type: tipo,
      category: state.categories.find((c) => c.type === tipo)?.id || state.categories[0].id,
      accountId: state.accounts[0]?.id || "",
      paymentMethod: state.paymentMethods[0]?.id || "",
    });
    setModalOpen(true);
  }

  function guardar(e) {
    e.preventDefault();
    if (!form.description || !form.amount || !form.accountId) return;
    dispatch({
      type: "ADD_TRANSACTION",
      payload: { ...form, amount: Number(form.amount), date: new Date(form.date).toISOString() },
    });
    setModalOpen(false);
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
              onDelete={() => dispatch({ type: "DELETE_TRANSACTION", payload: tx.id })}
            />
          ))
        )}
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={form.type === "ingreso" ? "Nuevo ingreso" : "Nuevo gasto"}>
        <form onSubmit={guardar} className="flex flex-col gap-3">
          <Field label="Descripción">
            <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Ej. Supermercado" required />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Monto (Bs)">
              <Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required />
            </Field>
            <Field label="Fecha">
              <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Categoría">
              <Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {categoriasDisponibles.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </Select>
            </Field>
            <Field label="Cuenta">
              <Select value={form.accountId} onChange={(e) => setForm({ ...form, accountId: e.target.value })}>
                {state.accounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="Método de pago">
            <Select value={form.paymentMethod} onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}>
              {state.paymentMethods.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </Select>
          </Field>
          <Button type="submit" className="mt-2">Guardar</Button>
        </form>
      </Modal>
    </div>
  );
}
