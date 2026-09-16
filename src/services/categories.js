export function normalizeCategory(category) {
  const fixed=new Set(["vivienda","servicios","deudas","educacion"]);
  return {...category,name:category.id === "vivienda" && category.name === "Vivienda" ? "Vivienda / Alquiler" : category.name,type:category.type === "ahorro" ? "gasto" : category.type,classification:category.type === "ingreso" ? null : category.classification || (fixed.has(category.id) ? "fijo" : "variable"),archived:Boolean(category.archived || category.type === "ahorro"),version:category.version || 1};
}
export function changeCategory(state, draft) {
  const previous=state.categories.find(item=>item.id === draft.id);
  if (previous?.system) throw new Error("La categoría generada Saldo inicial no se puede modificar.");
  if (!draft.name?.trim() || !["ingreso","gasto"].includes(draft.type) || (draft.type === "gasto" && !["fijo","variable"].includes(draft.classification))) throw new Error("Indica nombre, tipo y clasificación de la categoría.");
  if (previous && previous.type !== draft.type) throw new Error("El tipo de una categoría existente no se puede cambiar.");
  const category=normalizeCategory({...previous,...draft,name:draft.name.trim(),version:previous ? previous.version+1 : 1,color:previous?.color || "#1F5C56"});
  return {...state,categories:previous ? state.categories.map(item=>item.id === category.id ? category : item) : [...state.categories,category]};
}
