import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { oauthRedirectUrl, safeReturnPath, supabase, supabaseConfigured } from "../services/supabase/client.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!supabaseConfigured) {
      setLoading(false);
      return undefined;
    }
    let active = true;
    supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!active) return;
      if (sessionError) setError("No pudimos recuperar tu sesión. Intenta iniciar sesión otra vez.");
      setSession(data?.session || null);
      setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!active) return;
      if (event === "TOKEN_REFRESHED" || event === "SIGNED_IN" || event === "INITIAL_SESSION") setError("");
      if (event === "SIGNED_OUT") setSession(null);
      else if (nextSession) setSession(nextSession);
      setLoading(false);
    });
    return () => { active = false; data.subscription.unsubscribe(); };
  }, []);

  const signInWithGoogle = useCallback(async (returnTo = "/") => {
    setError("");
    if (!supabase) {
      setError("Falta configurar la conexión segura antes de iniciar sesión.");
      return { error: new Error("Supabase no configurado") };
    }
    const result = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: oauthRedirectUrl(safeReturnPath(returnTo)), skipBrowserRedirect: false },
    });
    if (result.error) setError("Google canceló el acceso o no pudimos iniciarlo. Puedes volver a intentarlo.");
    return result;
  }, []);

  const signOut = useCallback(async () => {
    setError("");
    const result = supabase ? await supabase.auth.signOut() : { error: null };
    setSession(null);
    if (result.error) setError("La sesión terminó localmente, pero no pudimos confirmar el cierre remoto.");
    return result;
  }, []);

  const value = useMemo(() => ({ session, user: session?.user || null, loading, error, configured: supabaseConfigured, signInWithGoogle, signOut, clearError: () => setError("") }), [session, loading, error, signInWithGoogle, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return value;
}

