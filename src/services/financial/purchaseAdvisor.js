// Herramienta "¿Puedo permitírmelo?". No compara solo contra el saldo:
// mira disponible real, ingresos, deuda y qué tan lejos deja al usuario
// de su colchón de liquidez recomendado.
import { calculateAvailableMoney, calculateFinancialHealth } from "./calculations.js";
import { getFinancialDataReadiness } from "./readiness.js";
import { fmtBs } from "./format.js";

export function evaluatePurchase(state, amount) {
  const purchaseAmount = Number(amount);
  if (!Number.isFinite(purchaseAmount) || purchaseAmount <= 0) {
    return {
      verdict: "sin_datos",
      label: "Indica un monto válido",
      explanation: "Escribe un precio mayor a cero para evaluar la compra.",
    };
  }

  if (!(state.accounts || []).length) {
    return {
      verdict: "sin_datos",
      label: "Todavía no tienes cuentas registradas",
      explanation: "Agrega al menos una cuenta en la sección Cuentas para que pueda evaluar tus compras con datos reales.",
    };
  }

  const { available, totalBalance } = calculateAvailableMoney(state);
  const health = calculateFinancialHealth(state);
  const readiness = getFinancialDataReadiness(state);
  const ingresos = readiness.latestMonth?.ingresos || 0;
  const restante = available - purchaseAmount;
  const restanteComoPctIngreso = ingresos > 0 ? restante / ingresos : null;

  if (purchaseAmount > totalBalance) {
    return {
      verdict: "no",
      label: "No recomendable",
      explanation: "El monto supera el dinero que tienes en tus cuentas en este momento.",
    };
  }

  if (restante < 0) {
    return {
      verdict: "no",
      label: "No recomendable",
      explanation: "Esta compra dejaría tu dinero disponible en negativo: no cubrirías tus próximos compromisos.",
    };
  }

  if (restanteComoPctIngreso === null) {
    return {
      verdict: "precaucion",
      label: "La compra cabe en tu saldo, pero falta información",
      explanation: "Registra un ingreso real para evaluar cuánto margen mensual te dejaría esta compra.",
    };
  }

  if (restanteComoPctIngreso < 0.15 || (health.available && health.score < 40)) {
    return {
      verdict: "precaucion",
      label: "Puedes comprarla, pero no es recomendable ahora",
      explanation: "Esta compra reduciría significativamente tu liquidez y podría dificultar el cumplimiento de tus próximos compromisos.",
    };
  }

  if (!health.available) {
    return {
      verdict: "precaucion",
      label: "La compra cabe en tu saldo, pero el análisis está incompleto",
      explanation: "Configura tu salud financiera en Análisis para valorar también tu reserva, deudas y objetivo de ahorro.",
    };
  }

  return {
    verdict: "si",
    label: "Recomendable",
      explanation: `Después de esta compra te quedarían ${fmtBs(restante, state.profile?.currency)} disponibles, un margen razonable frente a tus compromisos.`,
    restante,
  };
}
