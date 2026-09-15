import React, { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Eye, EyeOff } from "lucide-react";
import { Navigate, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { Button, Card, Input, Modal } from "../components/ui/primitives.jsx";
import { useAuth } from "../auth/AuthContext.jsx";
import { hasErrors, safeReturnPath, validateSignIn, validateSignUp } from "../auth/authState.js";

const EMPTY_SIGN_IN = { email: "", password: "" };
const EMPTY_SIGN_UP = { name: "", email: "", password: "", confirmation: "" };

export default function Login() {
  const auth = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const requestedView = ["signin", "signup", "update-password"].includes(params.get("view")) ? params.get("view") : "welcome";
  const [view, setView] = useState(requestedView);
  const [working, setWorking] = useState(false);
  const [guestConfirm, setGuestConfirm] = useState(false);
  const returnTo = useMemo(() => safeReturnPath(location.state?.returnTo), [location.state]);

  useEffect(() => () => auth.clearError(), [auth.clearError]);
  if (auth.status === "authenticated" || auth.status === "guest") return <Navigate to={returnTo} replace />;

  const google = async () => {
    if (working) return;
    setWorking(true);
    const result = await auth.signInWithGoogle(returnTo);
    if (result?.error) setWorking(false);
  };

  return <main className="min-h-screen bg-paper flex items-center justify-center p-4 sm:p-6">
    <Card className="w-full max-w-md shadow-card">
      <Brand />
      {auth.error ? <div role="alert" className="mb-4 rounded border border-brick/30 bg-brick/10 p-3 text-sm text-brick">{auth.error}</div> : null}
      {!auth.configured ? <div role="status" className="mb-4 rounded border border-ochre/30 bg-ochre/10 p-3 text-sm">La conexión segura todavía no está configurada.</div> : null}
      {view === "welcome" && <Welcome onView={setView} onGoogle={google} onGuest={() => setGuestConfirm(true)} working={working} configured={auth.configured} />}
      {view === "signin" && <SignIn auth={auth} working={working} setWorking={setWorking} onBack={() => setView("welcome")} onRegister={() => setView("signup")} onForgot={() => setView("forgot")} onGoogle={google} />}
      {view === "signup" && <SignUp auth={auth} working={working} setWorking={setWorking} onBack={() => setView("welcome")} onSignIn={() => setView("signin")} onGoogle={google} onConfirmation={() => setView("confirmation")} />}
      {view === "forgot" && <ForgotPassword auth={auth} working={working} setWorking={setWorking} onBack={() => setView("signin")} />}
      {view === "update-password" && <UpdatePassword auth={auth} working={working} setWorking={setWorking} onDone={() => navigate("/", { replace: true })} />}
      {view === "confirmation" && <Confirmation auth={auth} onSignIn={() => setView("signin")} />}
    </Card>
    <Modal open={guestConfirm} onClose={() => setGuestConfirm(false)} title="Continuar sin una cuenta">
      <p className="text-sm text-ink-soft">Puedes explorar Copiloto Financiero sin registrarte. Tus datos se guardarán únicamente en este navegador y no estarán disponibles en otros dispositivos. Si borras los datos del navegador, podrías perderlos.</p>
      <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={() => setGuestConfirm(false)}>Volver y crear una cuenta</Button>
        <Button onClick={() => { auth.enterGuest(); setGuestConfirm(false); }}>Continuar como invitado</Button>
      </div>
    </Modal>
  </main>;
}

function Brand() { return <div className="mb-6 text-center"><div className="mx-auto mb-3 h-11 w-11 rounded-full bg-teal text-white grid place-items-center font-display">CF</div><p className="font-display font-semibold">Copiloto Financiero</p></div>; }

function Welcome({ onView, onGoogle, onGuest, working, configured }) {
  return <div className="text-center"><h1 className="font-display text-2xl font-semibold">Bienvenido a Copiloto Financiero</h1><p className="mt-2 mb-6 text-sm text-ink-soft">Organiza tu dinero y toma decisiones con mayor claridad.</p><Button className="w-full" onClick={() => onView("signin")}>Iniciar sesión</Button><p className="my-4 text-sm">¿No tienes una cuenta? <button className="font-medium text-teal underline" onClick={() => onView("signup")}>Regístrate</button></p><Divider /><GoogleButton onClick={onGoogle} disabled={!configured || working}>{working ? "Abriendo Google…" : "Continuar con Google"}</GoogleButton><Button variant="ghost" className="mt-3 w-full no-underline" onClick={onGuest}>Continuar como invitado</Button></div>;
}

function SignIn({ auth, working, setWorking, onBack, onRegister, onForgot, onGoogle }) {
  const [form, setForm] = useState(EMPTY_SIGN_IN); const [errors, setErrors] = useState({});
  const submit = async (event) => { event.preventDefault(); if (working) return; const next = validateSignIn(form); setErrors(next); if (hasErrors(next)) return; setWorking(true); await auth.signInWithPassword(form); setWorking(false); };
  return <><BackButton onClick={onBack} /><h1 className="mb-5 font-display text-2xl font-semibold">Iniciar sesión</h1><form className="flex flex-col gap-4" onSubmit={submit} noValidate><AuthField id="signin-email" label="Correo electrónico" error={errors.email}><Input id="signin-email" type="email" autoComplete="email" autoFocus value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} aria-invalid={Boolean(errors.email)} /></AuthField><PasswordField id="signin-password" label="Contraseña" value={form.password} onChange={(password) => setForm({ ...form, password })} error={errors.password} autoComplete="current-password" /><button type="button" className="self-start text-sm text-teal underline" onClick={onForgot}>¿Olvidaste tu contraseña?</button><Button type="submit" disabled={working || !auth.configured}>{working ? "Iniciando sesión…" : "Iniciar sesión"}</Button></form><Divider /><GoogleButton onClick={onGoogle} disabled={working || !auth.configured}>Continuar con Google</GoogleButton><p className="mt-4 text-center text-sm">¿No tienes una cuenta? <button className="text-teal underline" onClick={onRegister}>Regístrate</button></p></>;
}

function SignUp({ auth, working, setWorking, onBack, onSignIn, onGoogle, onConfirmation }) {
  const [form, setForm] = useState(EMPTY_SIGN_UP); const [errors, setErrors] = useState({});
  const submit = async (event) => { event.preventDefault(); if (working) return; const next = validateSignUp(form); setErrors(next); if (hasErrors(next)) return; setWorking(true); const result = await auth.signUpWithPassword(form); setWorking(false); if (!result?.error && !result?.data?.session) { sessionStorage.setItem("copiloto-financiero:confirmation-email", form.email); onConfirmation(); } };
  return <><BackButton onClick={onBack} /><h1 className="mb-5 font-display text-2xl font-semibold">Crear una cuenta</h1><form className="flex flex-col gap-4" onSubmit={submit} noValidate><AuthField id="signup-name" label="Nombre" error={errors.name}><Input id="signup-name" autoComplete="name" autoFocus value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} aria-invalid={Boolean(errors.name)} /></AuthField><AuthField id="signup-email" label="Correo electrónico" error={errors.email}><Input id="signup-email" type="email" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} aria-invalid={Boolean(errors.email)} /></AuthField><PasswordField id="signup-password" label="Contraseña" value={form.password} onChange={(password) => setForm({ ...form, password })} error={errors.password} autoComplete="new-password" /><PasswordField id="signup-confirmation" label="Confirmar contraseña" value={form.confirmation} onChange={(confirmation) => setForm({ ...form, confirmation })} error={errors.confirmation} autoComplete="new-password" /><Button type="submit" disabled={working || !auth.configured}>{working ? "Creando cuenta…" : "Crear cuenta"}</Button></form><Divider /><GoogleButton onClick={onGoogle} disabled={working || !auth.configured}>Registrarme con Google</GoogleButton><p className="mt-4 text-center text-sm">¿Ya tienes una cuenta? <button className="text-teal underline" onClick={onSignIn}>Inicia sesión</button></p></>;
}

function ForgotPassword({ auth, working, setWorking, onBack }) {
  const [email, setEmail] = useState(""); const [sent, setSent] = useState(false); const [error, setError] = useState("");
  return <><BackButton onClick={onBack} /><h1 className="font-display text-2xl font-semibold">Recuperar contraseña</h1><p className="my-3 text-sm text-ink-soft">Si existe una cuenta asociada, enviaremos instrucciones para restablecerla.</p>{sent ? <p role="status" className="rounded bg-teal/10 p-3 text-sm">Revisa tu correo para continuar.</p> : <form onSubmit={async (e) => { e.preventDefault(); if (working) return; if (!/^\S+@\S+\.\S+$/.test(email)) { setError("Ingresa un correo válido."); return; } setWorking(true); const result = await auth.resetPassword(email); setWorking(false); if (!result.error) setSent(true); }} className="flex flex-col gap-4"><AuthField id="recovery-email" label="Correo electrónico" error={error}><Input id="recovery-email" type="email" autoComplete="email" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} /></AuthField><Button type="submit" disabled={working}>{working ? "Enviando…" : "Enviar instrucciones"}</Button></form>}</>;
}

function UpdatePassword({ auth, working, setWorking, onDone }) {
  const [password, setPassword] = useState(""); const [confirmation, setConfirmation] = useState(""); const [error, setError] = useState("");
  return <><h1 className="font-display text-2xl font-semibold">Crear nueva contraseña</h1><form className="mt-5 flex flex-col gap-4" onSubmit={async (e) => { e.preventDefault(); if (working) return; if (password.length < 6) return setError("La contraseña debe tener al menos 6 caracteres."); if (password !== confirmation) return setError("Las contraseñas no coinciden."); setError(""); setWorking(true); const result = await auth.updatePassword(password); setWorking(false); if (!result.error) onDone(); }}><PasswordField id="new-password" label="Nueva contraseña" value={password} onChange={setPassword} error={error} autoComplete="new-password" /><PasswordField id="new-password-confirm" label="Confirmar contraseña" value={confirmation} onChange={setConfirmation} autoComplete="new-password" /><Button type="submit" disabled={working}>{working ? "Guardando…" : "Guardar contraseña"}</Button></form></>;
}

function Confirmation({ auth, onSignIn }) {
  const email = sessionStorage.getItem("copiloto-financiero:confirmation-email") || ""; const [sent, setSent] = useState(false);
  return <div className="text-center"><h1 className="font-display text-2xl font-semibold">Revisa tu correo</h1><p className="my-4 text-sm text-ink-soft">Te enviamos un enlace para confirmar la cuenta. Podrás iniciar sesión después de confirmarla.</p>{sent ? <p role="status" className="mb-3 text-sm text-teal">Mensaje reenviado.</p> : null}<Button className="w-full" variant="secondary" disabled={!email} onClick={async () => { const result = await auth.resendConfirmation(email); if (!result.error) setSent(true); }}>Reenviar confirmación</Button><Button variant="ghost" className="mt-3" onClick={onSignIn}>Ir a iniciar sesión</Button></div>;
}

function AuthField({ id, label, error, children }) { return <label htmlFor={id} className="flex flex-col gap-1 text-sm"><span className="text-ink-soft">{label}</span>{React.cloneElement(children, { "aria-describedby": error ? `${id}-error` : children.props["aria-describedby"] })}{error ? <span id={`${id}-error`} role="alert" className="text-xs text-brick">{error}</span> : null}</label>; }
function PasswordField({ id, label, value, onChange, error, autoComplete }) { const [visible, setVisible] = useState(false); return <AuthField id={id} label={label} error={error}><span className="relative"><Input id={id} className="w-full pr-11" type={visible ? "text" : "password"} autoComplete={autoComplete} value={value} onChange={(e) => onChange(e.target.value)} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined} /><button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-ink-soft focus:outline-none focus:ring-2 focus:ring-teal" aria-label={visible ? `Ocultar ${label.toLowerCase()}` : `Mostrar ${label.toLowerCase()}`} onClick={() => setVisible(!visible)}>{visible ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}</button></span></AuthField>; }
function BackButton({ onClick }) { return <button className="mb-4 inline-flex items-center gap-1 rounded text-sm text-ink-soft focus:outline-none focus:ring-2 focus:ring-teal" onClick={onClick}><ArrowLeft size={16} aria-hidden="true" /> Volver</button>; }
function Divider() { return <div className="my-5 flex items-center gap-3 text-xs text-ink-soft"><span className="h-px flex-1 bg-line" /><span>o</span><span className="h-px flex-1 bg-line" /></div>; }
function GoogleButton({ children, ...props }) { return <Button variant="secondary" className="w-full" {...props}><span aria-hidden="true" className="font-bold text-[#4285F4]">G</span>{children}</Button>; }
