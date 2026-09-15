import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { oauthRedirectUrl, safeReturnPath, supabase, supabaseConfigured } from "../services/supabase/client.js";
import { AUTH_STATUS, GUEST_SESSION_KEY, authUiState, publicAuthError } from "./authState.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [guest, setGuest] = useState(false);

  useEffect(() => {
    if (!supabaseConfigured) {
      setGuest(globalThis.localStorage?.getItem(GUEST_SESSION_KEY) === "1");
      setLoading(false);
      return undefined;
    }
    let active = true;
    supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!active) return;
      if (sessionError) setError("No pudimos recuperar tu sesión. Intenta iniciar sesión otra vez.");
      setSession(data?.session || null);
      setGuest(!data?.session && globalThis.localStorage?.getItem(GUEST_SESSION_KEY) === "1");
      setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!active) return;
      if (event === "TOKEN_REFRESHED" || event === "SIGNED_IN" || event === "INITIAL_SESSION") setError("");
      if (event === "SIGNED_OUT") { setSession(null); setGuest(false); }
      else if (nextSession) { setSession(nextSession); setGuest(false); globalThis.localStorage?.removeItem(GUEST_SESSION_KEY); }
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

  const signInWithPassword = useCallback(async ({ email, password }) => {
    setError("");
    setGuest(false);
    globalThis.localStorage?.removeItem(GUEST_SESSION_KEY);
    if (!supabase) return { error: new Error("Supabase no configurado") };
    const result = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (result.error) setError(publicAuthError(result.error));
    return result;
  }, []);

  const signUpWithPassword = useCallback(async ({ name, email, password }) => {
    setError("");
    setGuest(false);
    globalThis.localStorage?.removeItem(GUEST_SESSION_KEY);
    if (!supabase) return { error: new Error("Supabase no configurado") };
    const result = await supabase.auth.signUp({
      email: email.trim(), password,
      options: { data: { name: name.trim(), display_name: name.trim() }, emailRedirectTo: oauthRedirectUrl("/") },
    });
    if (result.error) setError(publicAuthError(result.error, "No pudimos crear la cuenta. Revisa los datos o intenta iniciar sesión."));
    return result;
  }, []);

  const resetPassword = useCallback(async (email) => {
    setError("");
    if (!supabase) return { error: new Error("Supabase no configurado") };
    const result = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/login?view=update-password` });
    if (result.error) setError(publicAuthError(result.error, "No pudimos enviar las instrucciones. Intenta nuevamente."));
    return result;
  }, []);

  const updatePassword = useCallback(async (password) => {
    setError("");
    if (!supabase) return { error: new Error("Supabase no configurado") };
    const result = await supabase.auth.updateUser({ password });
    if (result.error) setError(publicAuthError(result.error, "No pudimos actualizar la contraseña."));
    return result;
  }, []);

  const resendConfirmation = useCallback(async (email) => {
    if (!supabase) return { error: new Error("Supabase no configurado") };
    const result = await supabase.auth.resend({ type: "signup", email: email.trim(), options: { emailRedirectTo: oauthRedirectUrl("/") } });
    if (result.error) setError(publicAuthError(result.error, "No pudimos reenviar el mensaje."));
    return result;
  }, []);

  const enterGuest = useCallback(() => {
    setError(""); setSession(null); setGuest(true);
    globalThis.localStorage?.setItem(GUEST_SESSION_KEY, "1");
  }, []);

  const leaveGuest = useCallback(() => {
    setGuest(false); globalThis.localStorage?.removeItem(GUEST_SESSION_KEY);
  }, []);

  const signOut = useCallback(async () => {
    setError("");
    const result = supabase ? await supabase.auth.signOut() : { error: null };
    setSession(null);
    setGuest(false);
    globalThis.localStorage?.removeItem(GUEST_SESSION_KEY);
    if (result.error) setError("La sesión terminó localmente, pero no pudimos confirmar el cierre remoto.");
    return result;
  }, []);

  const clearError = useCallback(() => setError(""), []);

  const user = session?.user || null;
  const status = authUiState({ loading, user, guest });
  const value = useMemo(() => ({ session, user, guest, status, loading, error, configured: supabaseConfigured, signInWithGoogle, signInWithPassword, signUpWithPassword, resetPassword, updatePassword, resendConfirmation, enterGuest, leaveGuest, signOut, clearError }), [session, user, guest, status, loading, error, signInWithGoogle, signInWithPassword, signUpWithPassword, resetPassword, updatePassword, resendConfirmation, enterGuest, leaveGuest, signOut, clearError]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return value;
}
