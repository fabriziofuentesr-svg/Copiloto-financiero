import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { safeReturnPath } from "../services/supabase/client.js";
import { useAuth } from "../auth/AuthContext.jsx";

export default function AuthCallback() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [waiting, setWaiting] = useState(true);
  const oauthError = params.get("error_description") || params.get("error");
  useEffect(() => {
    if (oauthError) { setWaiting(false); return; }
    if (auth.user) navigate(safeReturnPath(params.get("returnTo")), { replace: true });
    else if (!auth.loading) setWaiting(false);
  }, [auth.user, auth.loading, navigate, params, oauthError]);
  if (waiting || auth.loading) return <main className="min-h-screen grid place-items-center bg-paper"><p role="status">Completando el acceso seguro…</p></main>;
  return <main className="min-h-screen grid place-items-center bg-paper p-5"><div className="max-w-md text-center"><h1 className="font-display text-2xl">No pudimos completar el acceso</h1><p role="alert" className="my-3 text-ink-soft">Google canceló el proceso o el enlace ya no es válido.</p><button className="text-ochre underline" onClick={() => navigate("/login", { replace: true })}>Volver a intentarlo</button></div></main>;
}

