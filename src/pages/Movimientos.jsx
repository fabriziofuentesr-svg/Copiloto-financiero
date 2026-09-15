import React, { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CalendarClock, Pencil, Plus, Trash2 } from "lucide-react";
import { useFinanceDispatch, useFinanceState } from "../context/FinanceContext.jsx";
import { TransactionItem } from "../components/finance/cards.jsx";
import { TransactionForm } from "../components/finance/TransactionForm.jsx";
import { SectionGuide } from "../components/SectionGuide.jsx";
import { Button, Card, Field, Input, Modal, Select } from "../components/ui/primitives.jsx";
import { fmtBs } from "../services/financial/format.js";

export default function Movimientos() {
  const state = useFinanceState();
  const dispatch = useFinanceDispatch();
  const [params] = useSearchParams();
  const [modalOpen, setModalOpen] = useState(Boolean(params.get("nuevo")));
  const [movementType, setMovementType] = useState(params.get("nuevo") === "ingreso" ? "ingreso" : "gasto");
  const [editing, setEditing] = useState(null);
  const [recurringOpen, setRecurringOpen] = useState(false);
  const [filtroCategoria, setFiltroCategoria] = useState("todas");
  const [filtroCuenta, setFiltroCuenta] = useState("todas");
  const [busqueda, setBusqueda] = useState("");
  const [orden, setOrden] = useState("reciente");

  function abrirNuevo(tipo) { setMovementType(tipo); setModalOpen(true); }
  const movimientosFiltrados = useMemo(() => {
    let list = [...state.transactions];
    if (filtroCategoria !== "todas") list = list.filter((transaction) => transaction.category === filtroCategoria);
    if (filtroCuenta !== "todas") list = list.filter((transaction) => transaction.accountId === filtroCuenta);
    if (busqueda.trim()) list = list.filter((transaction) => transaction.description.toLowerCase().includes(busqueda.toLowerCase()));
    return list.sort((a, b) => orden === "reciente" ? new Date(b.date) - new Date(a.date) : orden === "antiguo" ? new Date(a.date) - new Date(b.date) : orden === "mayor" ? b.amount - a.amount : a.amount - b.amount);
  }, [state.transactions, filtroCategoria, filtroCuenta, busqueda, orden]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between flex-wrap gap-3"><h1 className="font-display text-2xl font-semibold">Movimientos</h1><div className="flex flex-wrap gap-2"><Button size="sm" variant="secondary" onClick={() => setRecurringOpen(true)}><CalendarClock size={14} /> Recurrentes</Button><Button size="sm" variant="secondary" onClick={() => abrirNuevo("ingreso")}><Plus size={14} /> Ingreso</Button><Button size="sm" onClick={() => abrirNuevo("gasto")}><Plus size={14} /> Gasto</Button></div></div>
      <Card><div className="grid sm:grid-cols-4 gap-3">
        <Field label="Buscar"><Input value={busqueda} onChange={(event) => setBusqueda(event.target.value)} placeholder="Descripción..." /></Field>
        <Field label="Categoría"><Select value={filtroCategoria} onChange={(event) => setFiltroCategoria(event.target.value)}><option value="todas">Todas</option>{state.categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</Select></Field>
        <Field label="Cuenta"><Select value={filtroCuenta} onChange={(event) => setFiltroCuenta(event.target.value)}><option value="todas">Todas</option>{state.accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</Select></Field>
        <Field label="Ordenar por"><Select value={orden} onChange={(event) => setOrden(event.target.value)}><option value="reciente">Más reciente</option><option value="antiguo">Más antiguo</option><option value="mayor">Mayor monto</option><option value="menor">Menor monto</option></Select></Field>
      </div></Card>
      <Card>{movimientosFiltrados.length === 0 ? <p className="text-ink-soft text-sm">No hay movimientos que coincidan. Registra uno o cambia los filtros.</p> : movimientosFiltrados.map((transaction) => <TransactionItem key={transaction.id} tx={transaction} categoryName={state.categories.find((category) => category.id === transaction.category)?.name || (transaction.type === "ajuste" ? "Ajuste de saldo" : transaction.category)} accountName={state.accounts.find((account) => account.id === transaction.accountId)?.name || "Cuenta eliminada"} currency={state.profile.currency} onEdit={!transaction.generated ? () => setEditing(transaction) : null} onDelete={!transaction.generated ? () => { if (window.confirm(`¿Eliminar “${transaction.description}”? El saldo de la cuenta se actualizará.`)) dispatch({ type: "DELETE_TRANSACTION", payload: transaction.id }); } : null} />)}</Card>
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={movementType === "ingreso" ? "Nuevo ingreso" : "Nuevo gasto"}><TransactionForm key={movementType} initialType={movementType} onSuccess={() => setModalOpen(false)} /></Modal>
      <Modal open={Boolean(editing)} onClose={() => setEditing(null)} title={`Editar ${editing?.description || "movimiento"}`}><TransactionForm key={editing?.id} transaction={editing} onSuccess={() => setEditing(null)} /></Modal>
      <Modal open={recurringOpen} onClose={() => setRecurringOpen(false)} title="Ingresos y gastos recurrentes"><RecurringManager /></Modal>
      <SectionGuide section="movements" />
    </div>
  );
}

function RecurringManager() {
  const state = useFinanceState();
  const dispatch = useFinanceDispatch();
  const [form, setForm] = useState({ kind: "gasto", name: "", amount: "", dayOfMonth: "1", category: "" });
  const [editingRecurring, setEditingRecurring] = useState(null);
  const items = [...(state.recurringIncomes || []).map((item) => ({ ...item, kind: "ingreso" })), ...(state.recurringExpenses || []).map((item) => ({ ...item, kind: "gasto" }))];
  const categories = state.categories.filter((category) => category.type === form.kind && !category.system);

  function save(event) {
    event.preventDefault();
    const recurringAmount = Number(form.amount);
    const day = Number(form.dayOfMonth);
    if (!form.name.trim() || !(recurringAmount > 0) || day < 1 || day > 31) return;
    dispatch({ type: editingRecurring ? "UPDATE_RECURRING_ITEM" : "ADD_RECURRING_ITEM", payload: { ...form, ...(editingRecurring ? { id: editingRecurring.id } : {}), name: form.name.trim(), amount: recurringAmount, dayOfMonth: day, category: form.category || categories[0]?.id, frequency: "mensual", active: true } });
    setForm({ kind: form.kind, name: "", amount: "", dayOfMonth: "1", category: "" });
    setEditingRecurring(null);
  }

  return <div className="flex flex-col gap-4">
    <div className="flex flex-col gap-2">{items.length ? items.map((item) => <div key={`${item.kind}-${item.id}`} className="flex items-center justify-between gap-3 rounded bg-paper-raised p-3 text-sm"><div><strong>{item.name}</strong><div className="text-xs text-ink-soft">{item.kind === "ingreso" ? "Ingreso" : "Gasto"} · día {item.dayOfMonth || "sin fecha"} · {fmtBs(item.amount, state.profile.currency)}</div></div><div className="flex gap-2"><button aria-label={`Editar recurrente ${item.name}`} onClick={() => { setEditingRecurring(item); setForm({ kind: item.kind, name: item.name, amount: String(item.amount), dayOfMonth: String(item.dayOfMonth || 1), category: item.category || "" }); }}><Pencil size={14} aria-hidden="true" /></button><button aria-label={`Eliminar recurrente ${item.name}`} onClick={() => { if (window.confirm(`Eliminar el movimiento recurrente “${item.name}”?`)) dispatch({ type: "DELETE_RECURRING_ITEM", payload: { id: item.id, kind: item.kind } }); }}><Trash2 size={14} aria-hidden="true" /></button></div></div>) : <p className="text-sm text-ink-soft">Todavía no tienes movimientos recurrentes.</p>}</div>
    <form onSubmit={save} className="border-t border-line pt-4 flex flex-col gap-3"><div className="grid grid-cols-2 gap-3"><Field label="Tipo"><Select value={form.kind} onChange={(event) => setForm({ ...form, kind: event.target.value, category: "" })}><option value="ingreso">Ingreso</option><option value="gasto">Gasto</option></Select></Field><Field label="Día del mes"><Input type="number" min="1" max="31" value={form.dayOfMonth} onChange={(event) => setForm({ ...form, dayOfMonth: event.target.value })} /></Field></div><Field label="Nombre"><Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></Field><div className="grid grid-cols-2 gap-3"><Field label="Monto"><Input type="number" min="0.01" step="0.01" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} required /></Field><Field label="Categoría"><Select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</Select></Field></div><Button type="submit">{editingRecurring ? "Guardar recurrente" : "Añadir recurrente"}</Button>{editingRecurring ? <Button variant="ghost" onClick={() => { setEditingRecurring(null); setForm({ kind: "gasto", name: "", amount: "", dayOfMonth: "1", category: "" }); }}>Cancelar edición</Button> : null}</form>
  </div>;
}
