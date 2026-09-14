import React, { useState } from "react";
import { HelpCircle } from "lucide-react";
import { useFinanceDispatch, useFinanceState } from "../context/FinanceContext.jsx";
import { Button, Modal } from "./ui/primitives.jsx";

const GUIDES = {
  home: { title: "Conoce tu Inicio", points: ["Completa un ingreso y un gasto reales después de crear tu cuenta.", "Cada análisis indica los datos que aún necesita.", "Abre Cuentas desde Dinero disponible para revisar saldos."] },
  movements: { title: "Conoce tus Movimientos", points: ["Registra aquí cada ingreso y gasto real.", "Los saldos iniciales y ajustes aparecen con una etiqueta y no alteran tus ingresos del mes.", "Configura movimientos recurrentes para mejorar las proyecciones."] },
  plans: { title: "Conoce tus Planes", points: ["Crea objetivos, configura tu fondo de emergencia y registra deudas.", "Tus metas personales ayudan a evaluar tu planificación.", "Los pagos y compromisos registrados alimentan las proyecciones."] },
  analysis: { title: "Conoce tu análisis financiero", points: ["La comparación usa los mismos días de este mes y del anterior.", "Cada componente de Salud financiera muestra su peso, razón y acción.", "Cierre de mes y próximos 30 días son proyecciones distintas.", "Revisa la confianza y los supuestos antes de decidir."] },
  copilot: { title: "Conoce tu Copiloto", points: ["Consulta cuánto tienes disponible y cómo van tus objetivos.", "Las respuestas utilizan únicamente los datos que registraste.", "Si falta información, el Copiloto te indicará qué debes completar."] },
  accounts: { title: "Conoce tus Cuentas", points: ["Un saldo mayor que cero genera un movimiento de apertura trazable.", "Editar el saldo crea un ajuste; el historial no se sobrescribe.", "Completa pago mínimo y fecha de las tarjetas para incorporarlas al análisis."] },
  settings: { title: "Conoce la Configuración", points: ["Cambiar de moneda requiere confirmar que los valores existentes no se convertirán.", "Puedes volver a ver la guía general cuando quieras.", "El modo demostración conserva y permite restaurar tus datos."] },
};

export function SectionGuide({ section, autoOpen = true }) {
  const state = useFinanceState();
  const dispatch = useFinanceDispatch();
  const [open, setOpen] = useState(() => autoOpen && !state.sectionGuidesSeen?.[section] && Object.keys(state.sectionGuidesSeen || {}).length === 0);
  const guide = GUIDES[section];
  if (!guide) return null;

  function close() {
    dispatch({ type: "MARK_SECTION_GUIDE_SEEN", payload: section });
    setOpen(false);
  }

  return (
    <>
      <div className="pt-2">
        <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
          <HelpCircle size={14} /> Guía de esta sección
        </Button>
      </div>
      <Modal open={open} onClose={close} title={guide.title}>
        <div className="flex flex-col gap-3">
          {guide.points.map((point, index) => (
            <div key={point} className="flex gap-3 text-sm">
              <span className="w-6 h-6 rounded-full bg-teal/10 text-teal flex items-center justify-center shrink-0 text-xs">{index + 1}</span>
              <p className="text-ink-soft pt-0.5">{point}</p>
            </div>
          ))}
          <Button className="mt-2" onClick={close}>Entendido</Button>
        </div>
      </Modal>
    </>
  );
}
