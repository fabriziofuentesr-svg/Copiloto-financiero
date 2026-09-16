import React, {useState} from "react";
import {useFinanceDispatch,useFinanceState} from "../../context/FinanceContext.jsx";
import {Button,Field,Input,Select} from "../ui/primitives.jsx";

export function CategoryManager() {
  const state=useFinanceState(); const dispatch=useFinanceDispatch();
  const empty={name:"",type:"gasto",classification:"variable"};
  const [form,setForm]=useState(empty); const [error,setError]=useState("");
  async function save(event) {
    event.preventDefault();setError("");
    try {const result=await dispatch({type:"SAVE_CATEGORY",payload:{...form,id:form.id || `category-${crypto.randomUUID()}`}});if(result?.ok === false) throw new Error(result.error);setForm(empty);} catch(error){setError(error.message);}
  }
  return <div className="flex flex-col gap-4"><p className="text-sm text-ink-soft">La clasificación nueva se aplica a nuevos registros. Los movimientos y planes guardados conservan su nombre y clasificación históricos.</p>
    <form onSubmit={save} className="flex flex-col gap-3"><Field label="Nombre de categoría"><Input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} required /></Field><div className="grid grid-cols-2 gap-3"><Field label="Tipo"><Select disabled={Boolean(form.id)} value={form.type} onChange={e=>setForm({...form,type:e.target.value})}><option value="ingreso">Ingreso</option><option value="gasto">Gasto</option></Select></Field>{form.type === "gasto" ? <Field label="Clasificación"><Select value={form.classification} onChange={e=>setForm({...form,classification:e.target.value})}><option value="fijo">Fijo</option><option value="variable">Variable</option></Select></Field> : null}</div>{error ? <p role="alert" className="text-sm text-brick">{error}</p> : null}<div className="flex gap-2"><Button type="submit">{form.id ? "Guardar categoría" : "Crear categoría"}</Button>{form.id ? <Button variant="secondary" onClick={()=>setForm(empty)}>Cancelar</Button> : null}</div></form>
    <div className="divide-y divide-line">{state.categories.map(category=><div key={category.id} className="py-3 flex flex-wrap justify-between gap-2 text-sm"><div><strong>{category.name}</strong><p className="text-xs text-ink-soft">{category.type === "ingreso" ? "Ingreso" : `Gasto ${category.classification}`} · {category.system ? "Generado" : category.archived ? "Archivada" : "Activa"}</p></div>{!category.system ? <div className="flex gap-2"><Button size="sm" variant="secondary" onClick={()=>setForm(category)}>Editar {category.name}</Button><Button size="sm" variant="ghost" onClick={async()=>{await dispatch({type:"SAVE_CATEGORY",payload:{...category,archived:!category.archived}});}}>{category.archived ? "Restaurar" : "Archivar"} {category.name}</Button></div> : null}</div>)}</div>
  </div>;
}
