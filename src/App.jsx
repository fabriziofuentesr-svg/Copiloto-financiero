import React from "react";
import { Navigate, Routes, Route } from "react-router-dom";
import { useFinanceState } from "./context/FinanceContext.jsx";
import { OnboardingFlow } from "./onboarding/OnboardingFlow.jsx";
import { AppShell } from "./layout/AppShell.jsx";
import Inicio from "./pages/Inicio.jsx";
import Movimientos from "./pages/Movimientos.jsx";
import Cuentas from "./pages/Cuentas.jsx";
import Planes from "./pages/Planes.jsx";
import Analisis from "./pages/Analisis.jsx";
import Copiloto from "./pages/Copiloto.jsx";
import PuedoComprarlo from "./pages/PuedoComprarlo.jsx";
import FlujoDeDinero from "./pages/FlujoDeDinero.jsx";
import Configuracion from "./pages/Configuracion.jsx";

export default function App() {
  const state = useFinanceState();

  // Usuario nuevo / no configurado: bienvenida -> configuración -> guía.
  // No usa rutas propias a propósito, para no interferir con la navegación
  // normal de la app ni con enlaces que alguien pudiera tener guardados.
  if (!state.profile.onboardingCompleted) {
    return <OnboardingFlow />;
  }

  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<Inicio />} />
        <Route path="/movimientos" element={<Movimientos />} />
        <Route path="/cuentas" element={<Cuentas />} />
        <Route path="/planes" element={<Planes />} />
        <Route path="/analisis" element={<Analisis />} />
        <Route path="/copiloto" element={<Copiloto />} />
        <Route path="/puedo-comprarlo" element={<PuedoComprarlo />} />
        <Route path="/flujo-de-dinero" element={<FlujoDeDinero />} />
        <Route path="/configuracion" element={<Configuracion />} />
        <Route path="/onboarding" element={<Navigate to="/" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
