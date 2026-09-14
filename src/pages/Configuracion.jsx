import React, { useState } from "react";
import { HelpCircle } from "lucide-react";
import { useFinanceState, useFinanceDispatch } from "../context/FinanceContext.jsx";
import { Card, Button, Modal } from "../components/ui/primitives.jsx";
import { ProfileForm } from "../onboarding/ProfileSetup.jsx";
import { GuideCarousel } from "../onboarding/GuideCarousel.jsx";
import { SectionGuide } from "../components/SectionGuide.jsx";

const EMPLOYMENT_LABELS = {
  dependiente: "Dependiente (sueldo fijo)",
  independiente: "Independiente",
  mixto: "Mixto",
  otro: "Otro",
};

export default function Configuracion() {
  const state = useFinanceState();
  const dispatch = useFinanceDispatch();
  const [editando, setEditando] = useState(false);
  const [guiaAbierta, setGuiaAbierta] = useState(false);

  return (
    <div className="flex flex-col gap-5 max-w-md">
      <h1 className="font-display text-2xl font-semibold">Configuración</h1>

      <Card title="Perfil" action={!editando && <Button size="sm" variant="secondary" onClick={() => setEditando(true)}>Editar</Button>}>
        {editando ? (
          <ProfileForm
            initialValues={state.profile}
            submitLabel="Guardar cambios"
            onSubmit={(data) => {
              dispatch({ type: "UPDATE_PROFILE", payload: data });
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
              value={state.profile.estimatedMonthlyIncome ? `${state.profile.currency === "USD" ? "USD" : "Bs"} ${state.profile.estimatedMonthlyIncome}` : "No especificado"}
            />
          </div>
        )}
      </Card>

      <Card title="Ayuda">
        <p className="text-sm text-ink-soft mb-3">Vuelve a ver la guía general de las secciones principales de la app.</p>
        <Button variant="secondary" onClick={() => setGuiaAbierta(true)}>
          <HelpCircle size={14} /> Ver guía rápida
        </Button>
      </Card>

      <Card title="Datos">
        <p className="text-sm text-ink-soft mb-3">
          Tu perfil y tus datos financieros se guardan en este navegador. Puedes explorar la app con datos de
          demostración; tus datos actuales se conservan y podrás restaurarlos al terminar. También puedes borrar tus
          datos financieros y empezar de nuevo, sin perder tu perfil.
        </p>
        <div className="flex flex-col gap-2">
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
