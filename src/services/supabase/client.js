import { createClient } from "@supabase/supabase-js";
import { safeReturnPath } from "../../auth/authState.js";

const url = import.meta.env.VITE_SUPABASE_URL?.trim();
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

export const supabaseConfigured = Boolean(url && anonKey);

export const supabase = supabaseConfigured
  ? createClient(url, anonKey, {
      auth: {
        flowType: "pkce",
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

export { safeReturnPath };

export function oauthRedirectUrl(returnTo = "/") {
  const configuredBase = import.meta.env.VITE_APP_URL?.replace(/\/$/, "");
  const base = configuredBase || window.location.origin;
  return `${base}/auth/callback?returnTo=${encodeURIComponent(safeReturnPath(returnTo))}`;
}
