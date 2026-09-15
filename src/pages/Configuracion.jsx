import React, { useState } from "react";
import { HelpCircle } from "lucide-react";
import { useFinanceState, useFinanceDispatch, useFinanceMeta } from "../context/FinanceContext.jsx";
import { Card, Button, Modal } from "../components/ui/primitives.jsx";
import { ProfileForm } from "../onboarding/ProfileSetup.jsx";
import { GuideCarousel } from "../onboarding/GuideCarousel.jsx";
import { SectionGuide } from "../components/SectionGuide.jsx";
import { Link, useNavigate } from "react-router-dom";
import { hasFinancialData } from "../services/financial/calculations.js";
import { fmtBs } from "../services/financial/format.js";
import { useAuth } from "../auth/AuthContext.jsx";
import { createFinanceRepository } from "../repositories/factory.js";

const EMPLOYMENT_LABELS = {
  dependiente: "Dependiente (sueldo fijo)",
  independiente: "Independiente",
  mixto: "Mixto",
  otro: "Otro",
};

export default function Configuracion() {
  const state = useFinanceState();
  const dispatch = useFinanceDispatch();
  const auth = useAuth();
  const meta = useFinanceMeta();
  const navigate = useNavigate();
  const [editando, setEditando] = useState(false);
  const [guiaAbierta, setGuiaAbierta] = useState(false);
  const [dataError, setDataError] = useState("");

  return (
    <div className="flex flex-col gap-5 max-w-md">
      <h1 className="font-display text-2xl font-semibold">Configuración</h1>

      <Card title="Perfil" action={!editando && <Button size="sm" variant="secondary" onClick={() => setEditando(true)}>Editar</Button>}>
        {editando ? (
          <ProfileForm
            initialValues={state.profile}
            submitLabel="Guardar cambios"
            onSubmit={(data) => {
              const currencyChanged = data.currency !== state.profile.currency;
              if (currencyChanged && hasFinancialData(state)) {
                const accepted = window.confirm(`Cambiarás la moneda principal de ${state.profile.currency} a ${data.currency} sin convertir los importes existentes. Los valores conservarán su número y quedará un registro del cambio. ¿Continuar?`);
                if (!accepted) return;
                const { currency, ...profileData } = data;
                dispatch({ type: "UPDATE_PROFILE_AND_CURRENCY", payload: { profile: profileData, currency } });
              } else {
                dispatch({ type: "UPDATE_PROFILE", payload: data });
              }
              setEditando(false);
            }}
          />
        ) : (
          <div className="flex flex-col gap-1.5 text-sm">
            <Row label="Nombre" value={state.profile.name || "—"} />
            <Row label="Moneda principal" value={state.profile.currency} />
            <Row label="Situación laboral" value={EMPLOYMENT_LABELS[state.profile.employmentType] || "No especificado"} />
            <Row
              label="Ingreso mensual aproximado"
              value={state.profile.estimatedMonthlyIncome ? `${fmtBs(state.profile.estimatedMonthlyIncome, state.profile.currency)} (estimación, no movimiento)` : "No especificado"}
            />
          </div>
        )}
      </Card>

      <Card title="Cuentas y saldos">
        <p className="text-sm text-ink-soft mb-3">Edita cuentas, tarjetas y registra ajustes de saldo con historial.</p>
        <Link to="/cuentas" className="text-ochre text-sm underline">Administrar cuentas</Link>
      </Card>

      <Card title="Ayuda">
        <p className="text-sm text-ink-soft mb-3">Vuelve a ver la guía general de las secciones principales de la app.</p>
        <Button variant="secondary" onClick={() => setGuiaAbierta(true)}>
          <HelpCircle size={14} /> Ver guía rápida
        </Button>
      </Card>

      <Card title="Datos">
        <p className="text-sm text-ink-soft mb-3">
          {auth.user ? "Tu perfil y tus datos financieros se guardan de forma segura en tu cuenta." : "Tu perfil y tus datos financieros se guardan en este navegador."} Puedes explorar la app con datos de
          demostración; tus datos actuales se conservan y podrás restaurarlos al terminar. También puedes borrar tus
          datos financieros y empezar de nuevo, sin perder tu perfil.
        </p>
        <div className="flex flex-col gap-2">
          {dataError ? <p role="alert" className="rounded bg-brick/10 p-3 text-sm text-brick">{dataError}</p> : null}
          {auth.user ? <Button variant="secondary" onClick={async () => {
            setDataError("");
            try {
              const data = await createFinanceRepository(auth).exportData();
              const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
              const url = URL.createObjectURL(blob);
              const link = document.createElement("a");
              link.href = url; link.download = `copiloto-financiero-${new Date().toISOString().slice(0, 10)}.json`; link.click();
              URL.revokeObjectURL(url);
            } catch (error) {
              setDataError(error.userMessage || "No pudimos preparar la exportación. Intenta otra vez.");
            }
          }}>Exportar mis datos</Button> : null}
          <Button
            variant="secondary"
            onClick={() => {
              if (confirm("Esto reemplaza tus datos reales por datos de demostración ficticios. ¿Continuar?")) {
                dispatch({ type: "LOAD_DEMO_DATA" });
              }
            }}
          >
            Cargar datos de ejemplo (demostración)
          </Button>
          {state.demoBackup && (
            <Button
              variant="secondary"
              onClick={() => dispatch({ type: "RESTORE_USER_DATA" })}
            >
              Restaurar mis datos anteriores
            </Button>
          )}
          <Button
            variant="danger"
            onClick={() => {
              if (confirm("Esto borra tus cuentas, movimientos, deudas y objetivos. Tu perfil se mantiene. ¿Continuar?")) {
                dispatch({ type: "CLEAR_FINANCIAL_DATA" });
              }
            }}
          >
            Borrar mis datos financieros
          </Button>
        </div>
      </Card>

      <Card title="Cuenta y sesión">
        {auth.status === "authenticated" ? <>
          <div className="mb-4 flex flex-col gap-1 text-sm"><Row label="Nombre" value={auth.user.user_metadata?.name || state.profile.name || "—"} /><Row label="Correo" value={auth.user.email || "—"} /><Row label="Proveedor" value={auth.user.app_metadata?.provider === "google" ? "Google" : "Correo y contraseña"} /></div>
          <Button variant="secondary" onClick={auth.signOut}>Cerrar sesión</Button>
          {meta.migration.available && meta.migration.status === "dismissed" ? <p className="mt-3 rounded bg-ochre/10 p-3 text-xs">Hay datos de invitado pendientes. Se conservarán localmente hasta que decidas importarlos en una próxima sesión.</p> : null}
          <p className="mt-3 text-xs text-ink-soft">La eliminación completa de la cuenta requiere definir primero la política legal de retención.</p>
        </> : <>
          <p className="font-medium">Estás usando Copiloto Financiero como invitado</p>
          <p className="my-3 text-sm text-ink-soft">Tus datos están guardados únicamente en este navegador y no se sincronizan con otros dispositivos.</p>
          <div className="flex flex-wrap gap-2"><Button onClick={() => { auth.leaveGuest(); navigate("/login?view=signup"); }}>Crear una cuenta</Button><Button variant="secondary" onClick={() => { auth.leaveGuest(); navigate("/login?view=signin"); }}>Iniciar sesión</Button></div>
          <Button variant="danger" className="mt-3" onClick={() => { if (confirm("Se eliminarán definitivamente todos los datos del modo invitado guardados en este navegador. No podrán recuperarse. ¿Continuar?")) { meta.clearGuestData(); auth.leaveGuest(); navigate("/login", { replace: true }); } }}>Eliminar datos de invitado</Button>
        </>}
      </Card>

      <Modal open={guiaAbierta} onClose={() => setGuiaAbierta(false)} title="Guía rápida">
        <GuideCarousel onFinish={() => setGuiaAbierta(false)} onSkip={() => setGuiaAbierta(false)} />
      </Modal>
      <SectionGuide section="settings" />
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between leader-dotted pb-1.5">
      <span className="text-ink-soft">{label}</span>
      <span>{value}</span>
    </div>
  );
}
