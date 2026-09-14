// Servicio de persistencia local. En este prototipo usamos localStorage,
// pero está aislado en un único archivo para poder migrar a un backend
// (Supabase/API propia) más adelante sin tocar el resto de la app.
const NAMESPACE = "copiloto-financiero:";

export function loadState(key) {
  try {
    const raw = localStorage.getItem(NAMESPACE + key);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    console.error("No se pudo leer del almacenamiento local", e);
    return null;
  }
}

export function saveState(key, value) {
  try {
    localStorage.setItem(NAMESPACE + key, JSON.stringify(value));
    return true;
  } catch (e) {
    console.error("No se pudo guardar en el almacenamiento local", e);
    return false;
  }
}

export function clearState(key) {
  try {
    localStorage.removeItem(NAMESPACE + key);
  } catch (e) {
    console.error("No se pudo borrar del almacenamiento local", e);
  }
}

