import React from "react";
import { Navigate } from "react-router-dom";

// Conserva compatibilidad con enlaces guardados de la versión anterior.
// La proyección completa ahora vive junto al resto del análisis financiero.
export default function FlujoDeDinero() {
  return <Navigate to="/analisis" replace />;
}
