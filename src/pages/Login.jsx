import React, { useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { Button, Card } from "../components/ui/primitives.jsx";
import { useAuth } from "../auth/AuthContext.jsx";
import { safeReturnPath } from "../auth/authState.js";

export default function Login() {
  const auth = useAuth();
  const location = useLocation();
  const [working, setWorking] = useState(false);
  if (auth.user) return <Navigate to={safeReturnPath(location.state?.returnTo)} replace />;
  return <main className="min-h-screen bg-paper flex items-center justify-center p-5">
    <Card className="w-full max-w-md text-center">
      <div className="mx-auto mb-4 h-10 w-10 rounded-full bg-teal text-white grid place-items-center font-display">CF</div>
      <h1 className="font-display text-2xl font-semibold">Copiloto Financiero</h1>
      <p className="mt-2 mb-6 text-sm text-ink-soft">Inicia sesión para proteger tus datos y consultarlos desde tus dispositivos.</p>
      {auth.error ? <div role="alert" className="mb-4 rounded border border-brick/30 bg-brick/10 p-3 text-sm text-brick">{auth.error}</div> : null}
      {!auth.configured ? <div role="status" className="mb-4 rounded border border-ochre/30 bg-ochre/10 p-3 text-sm">La conexión segura todavía no está configurada. Consulta la guía de instalación del proyecto.</div> : null}
      <Button disabled={!auth.configured || working} className="w-full" onClick={async () => { setWorking(true); await auth.signInWithGoogle(location.state?.returnTo || "/"); setWorking(false); }}>
        {working ? "Abriendo Google…" : "Continuar con Google"}
      </Button>
      <p className="mt-4 text-xs text-ink-soft">Al continuar, aceptas que tus datos financieros se almacenen asociados a tu cuenta. No solicitamos acceso a tu información bancaria.</p>
    </Card>
  </main>;
}
