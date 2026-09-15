export function safeReturnPath(value) {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) return "/";
  try {
    const decoded = decodeURIComponent(value);
    return decoded.startsWith("/") && !decoded.startsWith("//") ? decoded : "/";
  } catch {
    return "/";
  }
}

export function authUiState({ loading, user, error }) {
  if (loading) return "loading";
  if (error) return "error";
  return user ? "authenticated" : "anonymous";
}
