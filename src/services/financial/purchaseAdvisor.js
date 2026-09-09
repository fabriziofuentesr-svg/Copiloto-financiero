// Herramienta "¿Puedo permitírmelo?". No compara solo contra el saldo:
// mira disponible real, ingresos, deuda y qué tan lejos deja al usuario
// de su colchón de liquidez recomendado.
import { calculateAvailableMoney, calculateFinancialHealth, summarizeMonth } from "./calculations.js";

export function evaluatePurchase(state, amount) {
  if (state.accounts.length === 0) {
    return {
      verdict: "sin_datos",
      label: "Todavía no tienes cuentas registradas",
      explanation: "Agrega al menos una cuenta en la sección Cuentas para que pueda evaluar tus compras con datos reales.",
    };
  }

  const { available, totalBalance } = calculateAvailableMoney(state);
  const health = calculateFinancialHealth(state);
  const { ingresos } = summarizeMonth(state, "current");
  const restante = available - amount;
  const restanteComoPctIngreso = ingresos > 0 ? restante / ingresos : 0;

  if (amount > totalBalance) {
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

  if (restanteComoPctIngreso < 0.15 || health.score < 40) {
    return {
      verdict: "precaucion",
      label: "Puedes comprarla, pero no es recomendable ahora",
      explanation: "Esta compra reduciría significativamente tu liquidez y podría dificultar el cumplimiento de tus próximos compromisos.",
    };
  }

  return {
    verdict: "si",
    label: "Recomendable",
    explanation: `Después de esta compra te quedarían ${Math.round(restante)} bolivianos disponibles, un margen razonable frente a tus compromisos.`,
    restante,
  };
}
