import React, { useState } from "react";
import { HelpCircle } from "lucide-react";
import { useFinanceDispatch, useFinanceState } from "../context/FinanceContext.jsx";
import { Button, Modal } from "./ui/primitives.jsx";

const GUIDES = {
  home: { title: "Conoce tu Inicio", points: ["Completa un ingreso y un gasto reales después de crear tu cuenta.", "Cada análisis indica los datos que aún necesita.", "Abre Cuentas desde Dinero disponible para revisar saldos."] },
  movements: { title: "Conoce tus Movimientos", points: ["Registra aquí ingresos, gastos, transferencias y aportes reales.", "Los saldos iniciales, ajustes y transferencias no alteran los ingresos operativos del mes.", "Un pago puede vincularse a un compromiso; su estado siempre tiene un movimiento de respaldo.", "Los aportes asignan dinero existente: protégelo, transfiérelo o libéralo explícitamente."] },
  plans: { title: "Conoce tus Planes de Ahorro", points: ["Crea planes como Viaje, Auto o Celular y simula su plazo.", "Cada aporte nuevo debe estar respaldado por una cuenta.", "Proteger dinero reduce el disponible para gastar, pero conserva el dinero total.", "Liberar un aporte reduce el avance; no crea un ingreso."] },
  analysis: { title: "Conoce Mi mes", points: ["Configura estimaciones de todo el mes; no son movimientos reales.", "Separa compromisos fijos y límites variables. Registra los pagos desde Movimientos.", "La proyección resta únicamente lo pendiente y excluye cuentas de ahorro y dinero protegido.", "Salud financiera explica pesos, razones y datos desconocidos.", "La comparación utiliza periodos equivalentes y distingue estimaciones de hechos."] },
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
