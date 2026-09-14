import React, { useState } from "react";
import { HelpCircle } from "lucide-react";
import { useFinanceDispatch, useFinanceState } from "../context/FinanceContext.jsx";
import { Button, Modal } from "./ui/primitives.jsx";

const GUIDES = {
  home: { title: "Conoce tu Inicio", points: ["Consulta el resumen de lo que ya sabemos sobre tus finanzas.", "Los análisis aparecerán cuando exista información suficiente.", "Usa los accesos rápidos para ir a la sección donde puedes actuar."] },
  movements: { title: "Conoce tus Movimientos", points: ["Registra aquí cada ingreso y gasto real.", "Asigna una cuenta y categoría para alimentar los análisis.", "Dos meses con movimientos permiten comparar tu evolución."] },
  plans: { title: "Conoce tus Planes", points: ["Crea objetivos, configura tu fondo de emergencia y registra deudas.", "Tus metas personales ayudan a evaluar tu planificación.", "Los pagos y compromisos registrados alimentan las proyecciones."] },
  analysis: { title: "Conoce tu análisis financiero", points: ["Comparación mensual requiere movimientos de al menos dos meses.", "Salud financiera necesita ingresos, gastos esenciales, ahorro, reserva y deudas configuradas.", "Proyección utiliza saldos, ingresos esperados y compromisos registrados.", "Los insights evolucionan a medida que incorporas datos reales."] },
  copilot: { title: "Conoce tu Copiloto", points: ["Consulta cuánto tienes disponible y cómo van tus objetivos.", "Las respuestas utilizan únicamente los datos que registraste.", "Si falta información, el Copiloto te indicará qué debes completar."] },
  accounts: { title: "Conoce tus Cuentas", points: ["Registra dónde mantienes tu dinero y el saldo actual.", "Los movimientos actualizan automáticamente el saldo de la cuenta elegida.", "Las cuentas antiguas de tipo Banco siguen siendo compatibles."] },
  settings: { title: "Conoce la Configuración", points: ["Actualiza tu perfil y moneda principal.", "Puedes volver a ver la guía general cuando quieras.", "Tus datos permanecen guardados en este navegador."] },
};

export function SectionGuide({ section, autoOpen = true }) {
  const state = useFinanceState();
  const dispatch = useFinanceDispatch();
  const [open, setOpen] = useState(() => autoOpen && !state.sectionGuidesSeen?.[section]);
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
