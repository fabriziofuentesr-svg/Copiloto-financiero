export const AUTH_STATUS = Object.freeze({
  LOADING: "loading",
  AUTHENTICATED: "authenticated",
  GUEST: "guest",
  UNAUTHENTICATED: "unauthenticated",
});

export const GUEST_SESSION_KEY = "copiloto-financiero:guest-session-v1";

export function safeReturnPath(value) {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) return "/";
  try {
    const decoded = decodeURIComponent(value);
    return decoded.startsWith("/") && !decoded.startsWith("//") ? decoded : "/";
  } catch {
    return "/";
  }
}

export function authUiState({ loading, user, guest = false }) {
  if (loading) return AUTH_STATUS.LOADING;
  if (user) return AUTH_STATUS.AUTHENTICATED;
  return guest ? AUTH_STATUS.GUEST : AUTH_STATUS.UNAUTHENTICATED;
}

export function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

export function validateSignIn({ email, password }) {
  const errors = {};
  if (!isValidEmail(email)) errors.email = "Ingresa un correo electrónico válido.";
  if (!password) errors.password = "Ingresa tu contraseña.";
  return errors;
}

export function validateSignUp({ name, email, password, confirmation }) {
  const errors = validateSignIn({ email, password });
  if (!String(name || "").trim()) errors.name = "Ingresa tu nombre.";
  if (password && password.length < 6) errors.password = "La contraseña debe tener al menos 6 caracteres.";
  if (password !== confirmation) errors.confirmation = "Las contraseñas no coinciden.";
  return errors;
}

export function hasErrors(errors) { return Object.keys(errors).length > 0; }

export function publicAuthError(error, fallback = "No pudimos completar el acceso. Revisa los datos e intenta nuevamente.") {
  const message = String(error?.message || "").toLowerCase();
  if (message.includes("email not confirmed")) return "Debes confirmar tu correo antes de iniciar sesión.";
  if (message.includes("password") && message.includes("characters")) return "La contraseña no cumple los requisitos mínimos.";
  if (message.includes("rate") || message.includes("too many")) return "Hay demasiados intentos. Espera unos minutos e intenta nuevamente.";
  return fallback;
}
